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
            console.error('Error details:', {
                message: error.message,
                stack: error.stack,
                name: error.name
            })
        },
        onFinish: (message) => {
            console.log('Chat finished:', message)
            console.log('Final message state:', {
                content: message.content,
                role: message.role,
                id: message.id
            })
        },
        onResponse: (response) => {
            console.log('Got response:', response)
            console.log('Response details:', {
                status: response.status,
                statusText: response.statusText,
                headers: Object.fromEntries(response.headers.entries())
            })
        }
    })
    
    const noMessages= !messages || messages.length===0

    useEffect(() => {
        console.log('Messages updated:', messages)
        console.log('Current messages state:', {
            count: messages?.length,
            lastMessage: messages?.[messages.length - 1],
            isLoading
        })
    }, [messages, isLoading])

    const handlePrompt=(prompText)=>{
        console.log('Handling prompt:', prompText)
        const msg: Message= {
            id: crypto.randomUUID(),
            content:prompText,
            role:"user"
        }
        console.log('Appending message:', msg)
        append(msg)
    }

    const handleFormSubmit = async (e) => {
        e.preventDefault();
    
        if (!input.trim()) {
            console.log('Empty input, skipping submission');
            return;
        }
    
        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ messages: [{ content: input, role: 'user' }] }),
            });
    
            if (!response.ok) {
                console.error('Failed to send message', response);
                return;
            }

            // Use the built-in handleSubmit from useChat
            handleSubmit(e);
        } catch (error) {
            console.error('Error sending message:', error);
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