require("dotenv").config();
const express = require("express");
const TelegramBOT = require("node-telegram-bot-api");
const cloudinary = require("cloudinary").v2;
const https = require("https");
const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

// Use native fetch if Node >=18, else fallback to node-fetch
let fetch = global.fetch;
if (!fetch) fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const app = express();
const PORT = 3000;
const token = process.env.TOKEN;
const bot = new TelegramBOT(token, { polling: true });

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.API_KEY,
  api_secret: process.env.API_SECRET,
  secure: true
});

app.listen(PORT, () => console.log("✅ Server running on port", PORT));

// Handle photo upload
bot.on("photo", async (msg) => {
  const chatId = msg.chat.id;
  const fileId = msg.photo[msg.photo.length - 1].file_id;
  const filepath = path.join(__dirname, `${fileId}.jpg`);
  const file = await bot.getFile(fileId);
  const fileUrl = `https://api.telegram.org/file/bot${token}/${file.file_path}`;
  const fileStream = fs.createWriteStream(filepath);

  bot.sendMessage(chatId, "📥 Photo received. Uploading...");

  https.get(fileUrl, (res) => {
    res.pipe(fileStream);
    fileStream.on("finish", async () => {
      fileStream.close();
      try {
        const result = await cloudinary.uploader.upload(filepath);
        fs.unlinkSync(filepath);
        bot.sendMessage(chatId, `✅ Uploaded to Cloudinary:\n${result.secure_url}`);
      } catch (err) {
        console.error("Upload error:", err);
        bot.sendMessage(chatId, "❌ Upload failed.");
      }
    });
  });
});

// Handle video upload
bot.on("video", async (msg) => {
  const chatId = msg.chat.id;
  const fileId = msg.video.file_id;
  const filepath = path.join(__dirname, `${fileId}.mp4`);
  const file = await bot.getFile(fileId);
  const fileUrl = `https://api.telegram.org/file/bot${token}/${file.file_path}`;
  const fileStream = fs.createWriteStream(filepath);

  bot.sendMessage(chatId, "📥 Video received. Uploading...");

  https.get(fileUrl, (res) => {
    res.pipe(fileStream);
    fileStream.on("finish", async () => {
      fileStream.close();
      try {
        const result = await cloudinary.uploader.upload(filepath, {
          resource_type: "video"
        });
        fs.unlinkSync(filepath);
        bot.sendMessage(chatId, `✅ Uploaded to Cloudinary:\n${result.secure_url}`);
      } catch (err) {
        console.error("Upload error:", err);
        bot.sendMessage(chatId, "❌ Upload failed.");
      }
    });
  });
});

// /send <foldername> command
bot.onText(/\/send (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const folderName = match[1].trim();

  bot.sendMessage(chatId, `🔍 Searching folder: ${folderName}`);

  try {
    const result = await cloudinary.search
      .expression(`folder:${folderName}`)
      .sort_by("created_at", "desc")
      .max_results(50)
      .execute();

    const media = result.resources;
    if (!media.length) {
      bot.sendMessage(chatId, `❌ No media found in "${folderName}".`);
      return;
    }

    const randomFile = media[Math.floor(Math.random() * media.length)];
    const fileUrl = randomFile.secure_url;
    const type = randomFile.resource_type;

    if (type === "image") {
      bot.sendPhoto(chatId, fileUrl, { caption: `📂 From folder: ${folderName}` });
    } else if (type === "video") {
      bot.sendVideo(chatId, fileUrl, { caption: `📂 From folder: ${folderName}` });
    } else {
      bot.sendMessage(chatId, `🧾 File URL: ${fileUrl}`);
    }
  } catch (error) {
    console.error("Cloudinary error:", error);
    bot.sendMessage(chatId, "⚠️ Could not fetch media.");
  }
});

// Keyword-based image scraping (NO cloudinary upload)
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text?.trim();
  if (!text || text.startsWith("/")) return;

  bot.sendMessage(chatId, `🔎 Searching for: "${text}"...`);

  try {
    const searchUrl = `https://duckduckgo.com/?q=${encodeURIComponent(text)}&iax=images&ia=images`;
    const res = await fetch(searchUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/115 Safari/537.36"
      }
    });

    const html = await res.text();
    const $ = cheerio.load(html);
    const images = [];

    $("img").each((_, el) => {
      const src = $(el).attr("src") || $(el).attr("data-src");
      if (src && src.startsWith("http")) images.push(src);
    });

    if (!images.length) {
      bot.sendMessage(chatId, "❌ No images found.");
      return;
    }

    const topImages = images.slice(0, 3);
    for (const url of topImages) {
      await bot.sendPhoto(chatId, url, { caption: `🖼️ From keyword: ${text}` });
    }
  } catch (err) {
    console.error("Scraping error:", err);
    bot.sendMessage(chatId, "⚠️ Error while searching.");
  }
});