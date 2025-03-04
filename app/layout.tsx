import "./global.css";

export const metadata={
    title:"Eu Regulations",
    description:"Want to know if you comply with All the EU Regulations? Ask Away"
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