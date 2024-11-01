package com.example.demo.service;

import java.util.List;
import java.util.stream.Collectors;


import com.example.demo.model.message.AnalyseRequest;
import com.example.demo.repository.TransactionUserDao;
import com.example.demo.model.Account;
import com.example.demo.model.dto.TransactionRecordDTO;
import com.example.demo.model.redis.RedisAccount;
import com.example.demo.model.TransactionUser;
import com.example.demo.service.es.RecordSyncService;
import com.example.demo.service.rabbitmq.RabbitMQService;
import com.example.demo.utility.jwt.JwtUtil;
import com.example.demo.utility.converter.TransactionRecordConverter;
import com.example.demo.utility.converter.PromptConverter;
import com.example.demo.utility.GetCurrentUserInfo;
import org.springframework.transaction.annotation.Transactional;
import lombok.extern.slf4j.Slf4j;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import com.example.demo.repository.TransactionRecordDao;
import com.example.demo.repository.AccountDao;
import com.example.demo.model.TransactionRecord;
import org.springframework.web.bind.annotation.RequestHeader;

@Slf4j
@Service
public class TransactionRecordService {
    private final TransactionRecordDao transactionRecordDao;
    private final TransactionUserDao transactionUserDao;
    private final AccountDao accountDao;
    private final RecordSyncService recordSyncService;
    private final JwtUtil jwtUtil;
    private final RedisTemplate<String, Object> redisTemplate;
    private final GetCurrentUserInfo getCurrentUserInfo;
    private final RabbitMQService rabbitMQService;

    @Autowired private StringRedisTemplate stringRedisTemplate;


    @Autowired
    public TransactionRecordService(TransactionRecordDao transactionRecordDao, JwtUtil jwtUtil, RedisTemplate<String, Object> redisTemplate, AccountDao accountDao, TransactionUserDao transactionUserDao, RecordSyncService recordSyncService, GetCurrentUserInfo getCurrentUserInfo, RabbitMQService rabbitMQService) {
        this.transactionRecordDao = transactionRecordDao;
        this.transactionUserDao = transactionUserDao;
        this.jwtUtil = jwtUtil;
        this.redisTemplate = redisTemplate;
        this.accountDao = accountDao;
        this.recordSyncService = recordSyncService;
        this.getCurrentUserInfo = getCurrentUserInfo;
        this.rabbitMQService = rabbitMQService;
    }



    public List<TransactionRecord> getAllRecordsByAccountId(Long accountId) {
        return transactionRecordDao.findAllByAccountId(accountId);
    }

    @Transactional
    public void addTransactionRecord(@RequestHeader String token, TransactionRecordDTO transactionRecordDTO) {
        Long userId = jwtUtil.getUserIdFromToken(token.replace("Bearer ", ""));
        Long accountId = getCurrentUserInfo.getCurrentAccountId(userId);
        Account account = findAccountById(accountId);

        if (transactionRecordDTO.getType().equalsIgnoreCase("expense")) {
            account.setTotalExpense(account.getTotalExpense() + transactionRecordDTO.getAmount());
        }
        if (transactionRecordDTO.getType().equalsIgnoreCase("income")) {
            account.setTotalIncome(account.getTotalIncome() + transactionRecordDTO.getAmount());
        }
        TransactionRecord transactionRecord = TransactionRecordConverter.toTransactionRecord(transactionRecordDTO);
        transactionRecord.setAccount(account);
        transactionRecord.setUserId(userId);
        // save DB
        transactionRecordDao.save(transactionRecord);
        // save to elastic search
        recordSyncService.syncToElasticsearch(transactionRecord);
        // send to AI analyser
        String currentRecord = PromptConverter.parseLatestTransactionRecordToPrompt(transactionRecordDTO);
        AnalyseRequest request = new AnalyseRequest(accountId, currentRecord);
        log.info("Sending AnalyseRequest to AI analyser for accountId: {}", accountId);
        rabbitMQService.sendAnalyseRequestToAIAnalyser(request);
    }

    @Transactional
    public void updateTransactionRecord(Long id, TransactionRecordDTO newTransactionRecordDTO){
        TransactionRecord existingRecord = findTransactionRecordById(id);
        Account account = findAccountById(existingRecord.getAccount().getId());

        // Subtract the amount of the original record before updating
        if (existingRecord.getType().equalsIgnoreCase("expense")) {
            account.setTotalExpense(account.getTotalExpense() - existingRecord.getAmount());
        } else if (existingRecord.getType().equalsIgnoreCase("income")) {
            account.setTotalIncome(account.getTotalIncome() - existingRecord.getAmount());
        }

        // Update the amount of the account according to income and expense
        if (newTransactionRecordDTO.getType().equalsIgnoreCase("expense")) {
            account.setTotalExpense(account.getTotalExpense() + newTransactionRecordDTO.getAmount());
        } else if (newTransactionRecordDTO.getType().equalsIgnoreCase("income")) {
            account.setTotalIncome(account.getTotalIncome() + newTransactionRecordDTO.getAmount());
        }
        TransactionRecordConverter.updateTransactionRecordFromDTO(existingRecord, newTransactionRecordDTO);
        transactionRecordDao.save(existingRecord);
//      update record in the elastic search
        recordSyncService.updateInElasticsearch(existingRecord);

        updateRedisAccount(account);
    }


    public List<TransactionRecord> findRecordByAccountIdAndType(String type, Long accountId) {
        return transactionRecordDao.findByAccountIdAndType(type, accountId);
    }


    public void deleteTransactionRecord(Long id) {
        TransactionRecord record = findTransactionRecordById(id);
        Account account = findAccountById(record.getAccount().getId());

        if (record.getType().equalsIgnoreCase("expense")) {
            account.setTotalExpense(account.getTotalExpense() - record.getAmount());
        } else if (record.getType().equalsIgnoreCase("income")) {
            account.setTotalIncome(account.getTotalIncome() - record.getAmount());
        }

        transactionRecordDao.delete(record);
//      delete records from elastic search
        recordSyncService.deleteFromElasticsearch(id);

        updateRedisAccount(account);
    }

    @Transactional
    public void deleteTransactionRecordsInBatch(String token, List<Long> recordIds) {
        Long userId = jwtUtil.getUserIdFromToken(token.replace("Bearer ", ""));
        Long accountId = getCurrentUserInfo.getCurrentAccountId(userId);
        Account account = findAccountById(accountId);


        List<TransactionRecord> records = transactionRecordDao.findAllByIdInAndAccountId(recordIds, accountId);


        if (records.isEmpty()) {
            throw new RuntimeException("No records found for provided IDs and accountId: " + accountId);
        }


        // Update total income and expense based on the records to be deleted
        for (TransactionRecord record : records) {
            if (record.getType().equalsIgnoreCase("expense")) {
                account.setTotalExpense(account.getTotalExpense() - record.getAmount());
            } else if (record.getType().equalsIgnoreCase("income")) {
                account.setTotalIncome(account.getTotalIncome() - record.getAmount());
            }
        }


        // Delete records from database
        transactionRecordDao.deleteAll(records);


        // Delete batch of records from Elasticsearch
        recordSyncService.deleteFromElasticsearchInBatch(recordIds);


        // Update Redis cache with the modified account information
        updateRedisAccount(account);
    }


    @Transactional(readOnly = true)
    public List<TransactionRecordDTO> getCertainDaysRecords(Long accountId, Integer duration) {
        List<TransactionRecord> records = transactionRecordDao.findCertainDaysRecords(accountId, duration);
        return records.stream()
                .map(TransactionRecordConverter::convertTransactionRecordToDTO)
                .collect(Collectors.toList());
    }


    private void updateRedisAccount(Account account) {
        String redisAccountKey = "login_user:" + account.getTransactionUser().getId() + ":account:" + account.getId();
//        System.out.println("Redis Key: " + redisAccountKey);
        RedisAccount redisAccount = new RedisAccount(
                account.getId(),
                account.getAccountName(),
                account.getTotalIncome(),
                account.getTotalExpense());

//        System.out.println("Redis Account: " + redisAccount);

        try {
            redisTemplate.opsForValue().set(redisAccountKey, redisAccount);
        } catch (Exception e) {
            System.err.println("Error updating Redis account: " + e.getMessage());
        }
    }

    private TransactionRecord findTransactionRecordById(Long id) {
        return transactionRecordDao.findById(id)
                .orElseThrow(() -> new RuntimeException("Record not found for id: " + id));
    }

    private Account findAccountById(Long accountId) {
        return accountDao.findById(accountId)
                .orElseThrow(() -> new RuntimeException("Account not found for id: " + accountId));
    }

    private TransactionUser findTransactionUserById(Long userId) {
        return transactionUserDao.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found for id: " + userId));
    }

}