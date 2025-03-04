const Bubble =({message}) =>{
    const {content, role} = message
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