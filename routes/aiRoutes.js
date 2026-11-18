const express = require("express");
const { GoogleGenAI } = require("@google/genai");
const Service = require("../models/Service");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// একবার যে মডেলটি সফল হবে, সেটিকে মেমোরিতে সেভ রাখবে যাতে পরের রিকোয়েস্ট ২ সেকেন্ডে চলে আসে
let cachedWorkingModel = null;

// POST /api/ai/chat -> ফাস্ট AI সার্ভিস অ্যাসিস্ট্যান্ট
router.post("/chat", protect, async (req, res) => {
  try {
    const { message } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({
        success: false,
        message: "Please provide a message",
      });
    }

    const services = await Service.find().select(
      "name category price durationMinutes rating description",
    );

    const serviceCatalog = services
      .map(
        (s) =>
          `- ${s.name} (Category: ${s.category}, Price: $${s.price}, Duration: ${s.durationMinutes} mins, Rating: ${s.rating}★): ${s.description}`,
      )
      .join("\n");

    const systemInstruction = `You are ServicePro AI Assistant, a friendly customer support assistant for a home & lifestyle service booking app.
Catalog:
${serviceCatalog}

Rules:
1. Recommend suitable service(s) strictly from the catalog above.
2. Mention exact price ($) and duration (mins).
3. Keep replies concise and mobile-friendly.`;

    // ১. যদি আগে কোনো সচল মডেল পাওয়া গিয়ে থাকে, সরাসরি সেটিকে ট্রাই করবে
    if (cachedWorkingModel) {
      try {
        const fastResponse = await ai.models.generateContent({
          model: cachedWorkingModel,
          contents: message,
          config: { systemInstruction },
        });
        return res.status(200).json({
          success: true,
          reply: fastResponse.text,
        });
      } catch (_) {
        cachedWorkingModel = null; // ব্যস্ত হয়ে পড়লে ক্যাশ রিসেট করবে
      }
    }

    // ২. প্রথমবার বা ক্যাশ না থাকলে সচল Flash মডেল খুঁজে বের করা
    let candidateModels = [
      "gemini-3.8-flash-lite",
      "gemini-3.8-flash",
      "gemini-2.5-flash-lite",
    ];
    try {
      const modelPager = await ai.models.list();
      const dynamicFlashModels = [];
      for await (const m of modelPager) {
        const cleanName = m.name.replace("models/", "");
        if (
          cleanName.includes("flash") &&
          !cleanName.includes("image") &&
          !cleanName.includes("audio") &&
          m.supportedActions?.includes("generateContent")
        ) {
          dynamicFlashModels.push(cleanName);
        }
      }
      if (dynamicFlashModels.length > 0) {
        candidateModels = [
          ...new Set([...dynamicFlashModels, ...candidateModels]),
        ];
      }
    } catch (_) {}

    let replyText = "";
    let lastError = null;

    for (const modelName of candidateModels) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: message,
          config: { systemInstruction },
        });
        replyText = response.text;
        cachedWorkingModel = modelName; // সফল মডেলটি সেভ করে রাখা হলো
        break;
      } catch (err) {
        lastError = err;
        if (
          !err.message.includes("503") &&
          !err.message.includes("429") &&
          !err.message.includes("404")
        ) {
          throw err;
        }
      }
    }

    if (!replyText) {
      throw lastError;
    }

    res.status(200).json({
      success: true,
      reply: replyText,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "AI Assistant failed to respond: " + error.message,
    });
  }
});

module.exports = router;
