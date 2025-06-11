const dotenv =require("dotenv")

dotenv.config()

const express = require("express")

const cloudinary = require("cloudinary").v2

const https = require("https")


const fs = require("fs")

const path = require("path")

const TelegramBOT = require("node-telegram-bot-api")
const { url } = require("inspector")


const app = express()

const PORT = 3000



cloudinary.config({
    api_key:process.env.API_KEY,
    api_secret:process.env.API_SECRET,
    cloud_name:process.env.CLOUD_NAME,
    secure:true
})


const token = process.env.TOKEN


app.listen(PORT,()=>{
    console.log("running")
})


const bot = new TelegramBOT(token,{polling:true})
bot.on('photo', async (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, "Received");
   

    const fileId = msg.photo[msg.photo.length - 1].file_id;


    try {
        const file = await bot.getFile(fileId);
   

        const fileUrl = `https://api.telegram.org/file/bot${token}/${file.file_path}`;
   

        const filepath = path.join(__dirname, `${fileId}.jpg`);
  

        const fileStream = fs.createWriteStream(filepath);

        // download the file first
        https.get(fileUrl, (res) => {
            res.pipe(fileStream);
            fileStream.on('finish', async () => {
                fileStream.close();
                console.log("Download complete.");

                // upload to cloudinary after download complete
                try {
                    const result = await cloudinary.uploader.upload(filepath);
                    console.log("Uploaded to Cloudinary:");
                   
                    
                    // optionally delete the local file after upload
                    fs.unlinkSync(filepath);
                     bot.sendMessage(chatId,"Deleted Local store")
                } catch (uploadErr) {
                    console.error("Cloudinary upload error:");
                }
            });
        });
    } catch (err) {
        console.error("Error:", err);
    }
  
});