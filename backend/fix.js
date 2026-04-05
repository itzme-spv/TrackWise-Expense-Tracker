const fs = require("fs");

const envContent = `PORT=5000
NODE_ENV=development
MONGO_URI=mongodb://127.0.0.1:27017/expense-tracker
JWT_SECRET=super_secret_vit_fat_key_2026
JWT_EXPIRE=7d
CLIENT_ORIGIN=http://localhost:5173`;

// This forces the file to update to the LOCAL database
fs.writeFileSync("./.env", envContent);

console.log(
  "✅ BOOM! The .env file has been forcefully updated to use the LOCAL database.",
);
