const Bubble =({message}) =>{
    const {parts, role} = message
    // Extract text from parts array
    const textParts = parts.filter(part => part.type === 'text')
    const content = textParts.map(part => part.type === 'text' ? part.text : '').join('')
    
    return(
        <div className={`${role} bubble`} style={{ textAlign: 'left' }}>
            {content.split('\n\n').map((paragraph, index) => (
                <p key={index} style={{ marginBottom: '1.5rem' }}>
                    {paragraph}
                </p>
            ))}
        </div>
    )
}

export default Bubble
