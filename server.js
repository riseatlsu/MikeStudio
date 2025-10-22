import express from "express";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import OpenAI from "openai";
import cors from "cors";

dotenv.config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

console.log("API Key prefix:", process.env.OPENAI_API_KEY?.slice(0, 10));

app.post("/chatgpt", async (req, res) => {
  const { prompt } = req.body;
  console.log("➡️ User prompt:", prompt);

  try {
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `
            You are an interpreter that translates natural language instructions into robot commands.

            Always output a **valid JSON object only**, never text outside JSON.
            Format:

            {
            "commands": [
                { "action": "move", "direction": "forward", "steps": 2 },
                { "action": "rotate", "direction": "right" },
                { "action": "pick" },
                { "action": "release" }
            ]
            }
            `
        },
        { role: "user", content: prompt }
      ],
      temperature: 0
    });

    let reply = completion.choices[0].message.content.trim();
    console.log("⬅️ Raw ChatGPT reply:", reply);

    try {
      const jsonReply = JSON.parse(reply);
      res.json(jsonReply);
    } catch (parseErr) {
      console.error("❌ Parse error:", parseErr);
      res.json({ commands: [] });
    }
  } catch (err) {
    console.error("❌ ChatGPT error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(3000, () => {
  console.log("🚀 Chat server running on http://localhost:3000");
});
