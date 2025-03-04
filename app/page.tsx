"use client"
import Image from "next/image"
import AILogo from "./assets/logosaas.png"
import {useChat} from "ai/react"
import {Message} from "ai"
import Bubble from "./components/Bubble"
import LoadingBubble from "./components/LoadingBubble"
import PromptSuggestionsRow from "./components/PromptSuggestionsRow"
import {useEffect} from "react"

const Home =() =>{
    const {append, isLoading, messages, input, handleInputChange, handleSubmit, setMessages}= useChat({
        api: '/api/chat',
        onError: (error) => {
            console.error('Chat error:', error)
        },
        onFinish: (message) => {
            console.log('Chat finished:', message)
        },
        onResponse: (response) => {
            console.log('Got response:', response)
        }
    })
    
    const noMessages= !messages || messages.length===0

    useEffect(() => {
        console.log('Messages updated:', messages)
    }, [messages])

    const handlePrompt=(prompText)=>{
        console.log('Handling prompt:', prompText)
        const msg: Message= {
            id: crypto.randomUUID(),
            content:prompText,
            role:"user"
        }
        append(msg)
    }

    const handleFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        console.log('Form submitted with input:', input)
        if (!input.trim()) return
        handleSubmit(e)
    }

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