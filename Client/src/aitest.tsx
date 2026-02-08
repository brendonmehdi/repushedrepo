import {useState} from 'react';
import {GoogleGenAI} from "@google/genai";
import {Button} from "./components/ui/button.tsx";
import {getGeminiResponse} from "./api/auth.ts";

function Aitest() {
    const [response, setResponse] = useState("")


    const handleResponse = () => {
        try {
            const x = getGeminiResponse()
            console.log(x)
        }catch(err) {
            console.log(err)
        }
    }

    return (
        <div>
            <Button onClick={handleResponse}>Response</Button>

            {response ? (
                <h2>{response}</h2>
            ) : null}

        </div>
    );
}

export default Aitest;