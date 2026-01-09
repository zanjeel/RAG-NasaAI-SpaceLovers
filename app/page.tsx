"use client"
import Image from "next/image"
import AILogo from "./assets/logosaas.png"
import {useChat} from "@ai-sdk/react"
import {TextStreamChatTransport, UIMessage} from "ai"
import Bubble from "./components/Bubble"
import LoadingBubble from "./components/LoadingBubble"
import PromptSuggestionsRow from "./components/PromptSuggestionsRow"
import {useEffect, useState} from "react"


const Home =() =>{
    const [input, setInput] = useState("")
    
    const {sendMessage, status, messages, setMessages, error} = useChat({
        transport: new TextStreamChatTransport({
            api: '/api/chat',
            headers: {
                'Content-Type': 'application/json',
            },
        }),
        onError: (error) => {
            console.error('Chat error:', error)
            console.error('Error details:', {
                message: error.message,
                stack: error.stack,
                name: error.name
            })
        },
        onFinish: ({ message }) => {
            console.log('Chat finished:', message)
            const textParts = message.parts.filter(part => part.type === 'text')
            const content = textParts.map(part => part.type === 'text' ? part.text : '').join('')
            console.log('Final message state:', {
                content,
                role: message.role,
                id: message.id
            })
        },
    })
    
    const isLoading = status === 'streaming' || status === 'submitted'
    const noMessages= !messages || messages.length===0

    useEffect(() => {
        console.log('Messages updated:', messages)
        console.log('Current messages state:', {
            count: messages?.length,
            lastMessage: messages?.[messages.length - 1],
            isLoading
        })
    }, [messages, isLoading])

    const handlePrompt=(prompText: string)=>{
        console.log('Handling prompt:', prompText)
        sendMessage({ text: prompText })
    }

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setInput(e.target.value)
    }

    const handleFormSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
    
        if (!input.trim()) {
            console.log('Empty input, skipping submission');
            return;
        }
    
        try {
            console.log('Submitting form with input:', input);
            sendMessage({ text: input })
            setInput("")
        } catch (error) {
            console.error('Error submitting form:', error);
        }
    };

    return (
        <main>
            <header className="header">
                <div className="logo-container">
                    <Image src={AILogo} width="40" height="40" alt="AI Logo" className="logo"/>
                    <span className="logo-text">NasaAI</span>
                </div>
                <h1>For The Space Lovers</h1>
            </header>
            
            <section className={noMessages? "welcome-section": "chat-section"}>
                {noMessages? (
                    <>
                        <p className="starter-text">
                            Your Ultimate Source for Nasa Space Lovers Knowledge
                        </p>
                        <PromptSuggestionsRow onPromptClick={handlePrompt}/>
                    </>
                ):(
                    <>
                        {messages.map((message, index)=> (
                            <Bubble key={`message-${index}`} message={message}/>
                        ))}
                        {isLoading && <LoadingBubble/>}
                    </>
                )}
            </section>

            <form onSubmit={handleFormSubmit} className="input-form">
                <input 
                    className="question-box" 
                    onChange={handleInputChange} 
                    value={input} 
                    placeholder="Ask me anything about Nasa..."
                    disabled={isLoading}
                />
                <button type="submit" className="submit-button" disabled={isLoading}>
                    {isLoading ? 'Sending...' : 'Send'}
                </button>
            </form>
        </main>
    )
}

export default Home
