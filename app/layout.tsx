import "./global.css";

export const metadata={
    title:"Nasa AI",
    description:"Here you can ask anything about NASA"
}

const RootLayout=({children})=>{
    return (
    <html lang="en">
        <body>
            {children}
        </body>
    </html>
    )
}

export default RootLayout