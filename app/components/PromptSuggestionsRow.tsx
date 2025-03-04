import PromptSuggestionButton from "./PromptSuggestionButton"

const PromptSuggestionsRow =({onPromptClick}) =>{
    const prompts= [
        "What are NASA's latest space exploration missions?",
        "What is NASA's most famous space telescope?",
        "Tell me the most expensive space mission?",
        "Does NASA allow public participation in space exploration?",
    ]

    return(
        <div className="prompt-suggestion-row">
            {prompts.map((prompt, index)=>
            <PromptSuggestionButton
            key={`suggestion-${index}`}
            text={prompt}
            onClick={()=> onPromptClick(prompt)}
            />
        )}
        </div>
    )
}

export default PromptSuggestionsRow