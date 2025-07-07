const dotenv = require("dotenv");
dotenv.config();

const express = require("express");
const cloudinary = require("cloudinary").v2;
const https = require("https");
const fs = require("fs");
const path = require("path");
const TelegramBOT = require("node-telegram-bot-api");

const app = express();
const PORT = 3000;

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.API_KEY,
  api_secret: process.env.API_SECRET,
  secure: true
});

const token = process.env.TOKEN;
const bot = new TelegramBOT(token, { polling: true });

app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});

// Upload Telegram photo to Cloudinary
bot.on("photo", async (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, "📥 Photo received. Uploading...");

  const fileId = msg.photo[msg.photo.length - 1].file_id;
  try {
    const file = await bot.getFile(fileId);
    const fileUrl = `https://api.telegram.org/file/bot${token}/${file.file_path}`;
    const filepath = path.join(__dirname, `${fileId}.jpg`);
    const fileStream = fs.createWriteStream(filepath);

    https.get(fileUrl, (res) => {
      res.pipe(fileStream);
      fileStream.on("finish", async () => {
        fileStream.close();
        console.log("📸 Image downloaded.");
        try {
          const result = await cloudinary.uploader.upload(filepath);
          fs.unlinkSync(filepath);
          bot.sendMessage(chatId, `✅ Uploaded to Cloudinary: ${result.secure_url}`);
        } catch (uploadErr) {
          console.error("❌ Cloudinary upload error:", uploadErr);
          bot.sendMessage(chatId, "❌ Upload failed.");
        }
      });
    });
  } catch (err) {
    console.error("❌ Error:", err);
    bot.sendMessage(chatId, "⚠️ Failed to upload image.");
  }
});

// Upload Telegram video to Cloudinary
bot.on("video", async (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, "📥 Video received. Uploading...");

  const fileId = msg.video.file_id;
  try {
    const file = await bot.getFile(fileId);
    const fileUrl = `https://api.telegram.org/file/bot${token}/${file.file_path}`;
    const filepath = path.join(__dirname, `${fileId}.mp4`);
    const fileStream = fs.createWriteStream(filepath);

    https.get(fileUrl, (res) => {
      res.pipe(fileStream);
      fileStream.on("finish", async () => {
        fileStream.close();
        console.log("🎥 Video downloaded.");
        try {
          const result = await cloudinary.uploader.upload(filepath, {
            resource_type: "video"
          });
          fs.unlinkSync(filepath);
          bot.sendMessage(chatId, `✅ Uploaded to Cloudinary: ${result.secure_url}`);
        } catch (uploadErr) {
          console.error("❌ Cloudinary upload error:", uploadErr);
          bot.sendMessage(chatId, "❌ Upload failed.");
        }
      });
    });
  } catch (err) {
    console.error("❌ Error:", err);
    bot.sendMessage(chatId, "⚠️ Failed to upload video.");
  }
});

// Send random image or video from a Cloudinary folder
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
    if (media.length === 0) {
      bot.sendMessage(chatId, `❌ No media found in folder "${folderName}".`);
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
      bot.sendMessage(chatId, `❓ Unsupported media type: ${type}`);
    }
  } catch (error) {
    console.error("❌ Cloudinary search error:", error);
    bot.sendMessage(chatId, "⚠️ Could not fetch media. Try again.");
  }
});
