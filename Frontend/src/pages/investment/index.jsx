'use client'

import React, { useState, useEffect } from 'react'
import { Star, Filter, Youtube, Plus, Edit, Trash2, ChevronDown, ChevronUp, Search } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { toast } from "@/hooks/use-toast"
import wiseflowService from '@/services/WiseflowService'

export default function InvestmentPage() {
    const [insights, setInsights] = useState([])
    const [topics, setTopics] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [searchTerm, setSearchTerm] = useState('')
    const [showAddTopicDialog, setShowAddTopicDialog] = useState(false)
    const [showEditTopicDialog, setShowEditTopicDialog] = useState(false)
    const [newTopic, setNewTopic] = useState({ name: '', explaination: '' })
    const [editingTopic, setEditingTopic] = useState(null)
    const [openItem, setOpenItem] = useState(null)
    const [isTopicsExpanded, setIsTopicsExpanded] = useState(false)

    useEffect(() => {
        const handleInsightsUpdate = (data) => {
            setInsights(data)
            setLoading(false)
            setError(null)
        }

        const handleTopicsUpdate = (data) => {
            setTopics(data)
        }

        wiseflowService.subscribe(handleInsightsUpdate)
        wiseflowService.subscribeToTopics(handleTopicsUpdate)

        return () => {
            wiseflowService.unsubscribe(handleInsightsUpdate)
            wiseflowService.unsubscribeFromTopics(handleTopicsUpdate)
        }
    }, [])

    const handleAddTopic = async () => {
        if (newTopic.name.trim()) {
            try {
                const result = await wiseflowService.saveTopics([newTopic])
                if (result.success) {
                    setNewTopic({ name: '', explaination: '' })
                    setShowAddTopicDialog(false)
                    toast({
                        title: "Success",
                        description: "New topic added successfully.",
                    })
                } else {
                    throw new Error(result.message)
                }
            } catch (error) {
                console.error('Failed to add topic:', error)
                toast({
                    title: "Error",
                    description: "Failed to add topic. Please try again.",
                    variant: "destructive",
                })
            }
        }
    }

    const handleUpdateTopic = async () => {
        if (editingTopic && editingTopic.name.trim()) {
            try {
                const result = await wiseflowService.updateTopic(editingTopic.id, editingTopic)
                if (result.success) {
                    setShowEditTopicDialog(false)
                    toast({
                        title: "Success",
                        description: "Topic updated successfully.",
                    })
                } else {
                    throw new Error(result.message)
                }
            } catch (error) {
                console.error('Failed to update topic:', error)
                toast({
                    title: "Error",
                    description: "Failed to update topic. Please try again.",
                    variant: "destructive",
                })
            }
        }
    }

    const handleDeleteTopic = async (id) => {
        try {
            const result = await wiseflowService.softDeleteTopic(id)
            if (result.success) {
                toast({
                    title: "Success",
                    description: "Topic deleted successfully.",
                })
            } else {
                throw new Error(result.message)
            }
        } catch (error) {
            console.error('Failed to delete topic:', error)
            toast({
                title: "Error",
                description: "Failed to delete topic. Please try again.",
                variant: "destructive",
            })
        }
    }

    const filteredInsights = insights.filter(insight =>
        insight.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        insight.description.toLowerCase().includes(searchTerm.toLowerCase())
    )

    const renderInsights = () => {
        return filteredInsights.map((insight, index) => (
            <motion.div
                key={insight.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
            >
                <Card className="flex flex-col h-full transition-shadow duration-300 hover:shadow-lg">
                    <CardHeader>
                        <CardTitle>{insight.title}</CardTitle>
                    </CardHeader>
                    <CardContent className="flex-grow">
                        <img src={insight.thumbnail} alt={insight.title} className="w-full h-40 object-cover mb-4 rounded-md" />
                        <p className="text-sm text-gray-600">{insight.description}</p>
                    </CardContent>
                    <div className="p-6 pt-0">
                        <Button
                            variant="outline"
                            onClick={() => setOpenItem(insight)}
                            className="w-full transition-colors duration-300 hover:bg-primary hover:text-primary-foreground"
                        >
                            Watch Video
                        </Button>
                    </div>
                </Card>
            </motion.div>
        ))
    }

    const renderTopics = () => {
        return topics.map((topic, index) => (
            <motion.div
                key={topic.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
                className="flex items-center justify-between p-2 border-b last:border-b-0 hover:bg-gray-50 transition-colors duration-200"
            >
                <span className="font-medium">{topic.name}</span>
                <div className="flex space-x-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                            setEditingTopic(topic)
                            setShowEditTopicDialog(true)
                        }}
                        className="transition-transform duration-200 hover:scale-110"
                    >
                        <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteTopic(topic.id)}
                        className="transition-transform duration-200 hover:scale-110"
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            </motion.div>
        ))
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    className="rounded-full h-32 w-32 border-t-2 border-b-2 border-primary"
                />
            </div>
        )
    }

    return (
        <div className="container mx-auto px-4 py-8">
            <motion.h1
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="text-4xl font-bold mb-8"
            >
                Investment Insights
            </motion.h1>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="flex items-center mb-6 space-x-4"
            >
                <div className="relative flex-grow">
                    <Input
                        type="text"
                        placeholder="Search insights..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 pr-4 py-2"
                    />
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                </div>
                <Button
                    onClick={() => setShowAddTopicDialog(true)}
                    className="transition-transform duration-200 hover:scale-105"
                >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Topic
                </Button>
            </motion.div>

            <AnimatePresence>
                {error && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded relative mb-6"
                        role="alert"
                    >
                        <strong className="font-bold">Note: </strong>
                        <span className="block sm:inline">{error}</span>
                    </motion.div>
                )}
            </AnimatePresence>

            <Collapsible
                open={isTopicsExpanded}
                onOpenChange={setIsTopicsExpanded}
                className="mb-8"
            >
                <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-bold">Topics</h2>
                    <CollapsibleTrigger asChild>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="transition-transform duration-200 hover:scale-110"
                        >
                            {isTopicsExpanded ? (
                                <ChevronUp className="h-4 w-4" />
                            ) : (
                                <ChevronDown className="h-4 w-4" />
                            )}
                        </Button>
                    </CollapsibleTrigger>
                </div>
                <CollapsibleContent>
                    <Card className="mt-4">
                        <CardContent className="divide-y">
                            {renderTopics()}
                        </CardContent>
                    </Card>
                </CollapsibleContent>
            </Collapsible>

            <motion.h2
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.4 }}
                className="text-2xl font-bold mb-4"
            >
                Insights
            </motion.h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {renderInsights()}
            </div>

            <Dialog open={showAddTopicDialog} onOpenChange={setShowAddTopicDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add New Topic</DialogTitle>
                        <DialogDescription>
                            Enter a name and optional explaination for the new topic.
                        </DialogDescription>
                    </DialogHeader>
                    <Input
                        type="text"
                        placeholder="Topic name"
                        value={newTopic.name}
                        onChange={(e) => setNewTopic({ ...newTopic, name: e.target.value })}
                        className="mb-4"
                    />
                    <Input
                        type="text"
                        placeholder="Topic explaination (optional)"
                        value={newTopic.explaination}
                        onChange={(e) => setNewTopic({ ...newTopic, explaination: e.target.value })}
                        className="mb-4"
                    />
                    <DialogFooter>
                        <Button onClick={handleAddTopic}>Add Topic</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={showEditTopicDialog} onOpenChange={setShowEditTopicDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit Topic</DialogTitle>
                        <DialogDescription>
                            Update the name and explaination for this topic.
                        </DialogDescription>
                    </DialogHeader>
                    <Input
                        type="text"
                        placeholder="Topic name"
                        value={editingTopic?.name || ''}
                        onChange={(e) => setEditingTopic(prev => prev ? { ...prev, name: e.target.value } : null)}
                        className="mb-4"
                    />
                    <Input
                        type="text"
                        placeholder="Topic explaination (optional)"
                        value={editingTopic?.explaination || ''}
                        onChange={(e) => setEditingTopic(prev => prev ? { ...prev, explaination: e.target.value } : null)}
                        className="mb-4"
                    />
                    <DialogFooter>
                        <Button onClick={handleUpdateTopic}>Update Topic</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={!!openItem} onOpenChange={() => setOpenItem(null)}>
                <DialogContent className="sm:max-w-[800px]">
                    <DialogHeader>
                        <DialogTitle>{openItem?.title}</DialogTitle>
                        <DialogDescription>
                            Watch the video and view details about this investment insight.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="mt-4">
                        <div className="aspect-video">
                            <iframe
                                src={openItem?.videoUrl}
                                title={openItem?.title}
                                className="w-full h-full"
                                allowFullScreen
                            ></iframe>
                        </div>
                        <h3 className="text-lg font-semibold mt-4 mb-2">Description</h3>
                        <p className="text-sm text-gray-600 mb-4">{openItem?.description}</p>
                    </div>
                    <DialogFooter>
                        <Button asChild>
                            <a href={openItem?.youtubeUrl} target="_blank" rel="noopener noreferrer">
                                <Youtube className="mr-2 h-4 w-4" />
                                Watch on YouTube
                            </a>
                        </Button>
                        <Button onClick={() => setOpenItem(null)}>Close</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}