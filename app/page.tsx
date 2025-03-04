"use client"
import Image from "next/image"
import AILogo from "./assets/logosaas.png"
import {useChat} from "ai/react"
import {Message} from "ai"
import Bubble from "./components/Bubble"
import LoadingBubble from "./components/LoadingBubble"
import PromptSuggestionsRow from "./components/PromptSuggestionsRow"

const Home =() =>{
    const {append, isLoading, messages, input, handleInputChange, handleSubmit}= useChat()
    
    const noMessages= !messages || messages.length===0

    const handlePrompt=(prompText)=>{
        const msg: Message= {
            id: crypto.randomUUID(),
            content:prompText,
            role:"user"
        }
        append(msg)
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
                        {messages.map((message, index)=> <Bubble key={`message-${index}`} message={message}/>)}
                        {isLoading && <LoadingBubble/>}
                    </>
                )}
            </section>

            <form onSubmit={handleSubmit} className="input-form">
                <input 
                    className="question-box" 
                    onChange={handleInputChange} 
                    value={input} 
                    placeholder="Ask me anything about Nasa..."
                />
                <button type="submit" className="submit-button">
                    Send
                </button>
            </form>
        </main>
    )
}

export default Home