// Import necessary modules
require("dotenv").config(); // Load environment variables from .env file
const express = require("express");
const mongoose = require("mongoose"); // Mongoose for MongoDB interaction
const bcrypt = require("bcrypt"); // For password hashing and comparison
const cors = require("cors");

// Initialize the Express application
const app = express();
// Render sets the PORT environment variable. We use that, or 3000 for local development.
const PORT = process.env.PORT || 3000;

// MongoDB Atlas connection URI
const MONGO_URI = process.env.MONGO_URI;

// Middleware
app.use(cors()); // Enable CORS for all routes (important for frontend-backend communication)
app.use(express.json()); // Parse incoming JSON request bodies

// --- Database Connection ---
mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log("Connected to MongoDB Atlas");
    // Seed admin user and example software after successful database connection
    seedAdminUser();
    seedSoftwareData(); // Call new function to seed example software
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err);
    process.exit(1); // Exit process if cannot connect to DB
  });

// --- Mongoose Schemas and Models ---

// Schema for Admin User
const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },
});

// Hash password before saving a new user or updating password
userSchema.pre("save", async function (next) {
  if (this.isModified("password")) {
    this.password = await bcrypt.hash(this.password, 10); // Hash with salt rounds = 10
  }
  next();
});

const User = mongoose.model("User", userSchema);

// Schema for Software Artifacts
const softwareSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  downloadUrl: {
    type: String,
    required: false, // Not all software might have a direct download URL
  },
  imageType: {
    type: String,
    enum: ['icon', 'image'], // New: Specifies if it's an icon or an image URL
    default: 'icon', // Default to icon
    required: true,
  },
  icon: {
    type: String, // e.g., "fa-book-spells" - now conditionally required based on imageType
    required: function() { return this.imageType === 'icon'; } // Required only if imageType is 'icon'
  },
  imageUrl: {
    type: String, // New: URL for the image
    required: function() { return this.imageType === 'image'; } // Required only if imageType is 'image'
  },
  color: {
    type: String, // e.g., "spellbook" for CSS styling
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const Software = mongoose.model("Software", softwareSchema);

// --- Admin User and Software Seeding Functions ---

async function seedAdminUser() {
  try {
    const adminUsername = process.env.ADMIN_USERNAME || "archmage";
    const adminPassword = process.env.ADMIN_PASSWORD || "elderScrolls123"; // Default fallback

    const existingAdmin = await User.findOne({ username: adminUsername });

    if (!existingAdmin) {
      const newAdmin = new User({
        username: adminUsername,
        password: adminPassword,
      });
      await newAdmin.save();
      console.log(
        "Default admin user created in MongoDB Atlas:",
        adminUsername
      );
    } else {
      console.log("Admin user already exists in MongoDB Atlas.");
    }
  } catch (error) {
    console.error("Error seeding admin user:", error);
  }
}

async function seedSoftwareData() {
  try {
    const existingSoftwareCount = await Software.countDocuments();
    if (existingSoftwareCount === 0) {
      // Seed with initial software data if the collection is empty
      const initialSoftware = [
        {
          name: "Spellbook Pro",
          description:
            "A powerful documentation tool that organizes your magical notes and spells with intelligent search and categorization.",
          downloadUrl: "https://www.example.com/spellbook-pro-v1.0.zip",
          imageType: "icon", // Default to icon
          icon: "fa-solid fa-scroll",
          color: "spellbook",
        },
        {
          name: "Crystal Ball",
          description:
            "Advanced analytics and prediction software that helps you foresee trends and make data-driven decisions.",
          downloadUrl: "https://www.example.com/crystal-ball-v2.0.exe",
          imageType: "icon",
          icon: "fa-solid fa-ring",
          color: "crystal",
        },
        {
          name: "Dragon Scale Defender",
          description:
            "Robust security software providing an impenetrable shield against digital threats and dark magic.",
          downloadUrl: "https://www.example.com/dragon-defender.zip",
          imageType: "image", // Example with image
          imageUrl: "https://placehold.co/120x120/4a5a9a/ffffff?text=DRAGON", // Placeholder image
          color: "dragon",
        },
        {
          name: "Alchemy Lab",
          description: "Transform raw data into refined insights with this powerful data processing tool.",
          downloadUrl: "https://www.example.com/alchemy-lab-v1.0.zip",
          imageType: "icon",
          icon: "fa-solid fa-flask",
          color: "alchemy",
        },
        {
          name: "Rune Compiler",
          description: "Convert ancient runes into executable code with this mystical compiler.",
          downloadUrl: "https://www.example.com/rune-compiler-v1.0.zip",
          imageType: "icon",
          icon: "fa-solid fa-code",
          color: "rune",
        },
      ];
      await Software.insertMany(initialSoftware);
      console.log("Initial software data seeded into MongoDB Atlas.");
    } else {
      console.log(
        "Software collection already contains data. Skipping seeding."
      );
    }
  } catch (error) {
    console.error("Error seeding software data:", error);
  }
}

// --- API Endpoints ---

// POST /api/admin/login: Authenticate admin user against MongoDB
app.post("/api/admin/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    const user = await User.findOne({ username });

    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (isMatch) {
      res.json({ message: "Login successful" });
    } else {
      res.status(401).json({ message: "Invalid credentials" });
    }
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Server error during login" });
  }
});

// POST /api/admin/change-password: Change admin password
app.post("/api/admin/change-password", async (req, res) => {
  const { username, currentPassword, newPassword } = req.body;

  if (!username || !currentPassword || !newPassword) {
    return res
      .status(400)
      .json({
        message:
          "All fields (username, currentPassword, newPassword) are required.",
      });
  }

  try {
    const user = await User.findOne({ username });

    if (!user) {
      return res.status(401).json({ message: "Invalid username." });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);

    if (!isMatch) {
      return res
        .status(401)
        .json({ message: "Current password is incorrect." });
    }

    user.password = newPassword; // Mongoose pre-save hook will hash this
    await user.save();

    res.json({ message: "Admin password updated successfully." });
  } catch (error) {
    console.error("Error changing admin password:", error);
    res.status(500).json({ message: "Server error during password change." });
  }
});

// POST /api/admin/change-username: Change admin username
app.post("/api/admin/change-username", async (req, res) => {
  const { currentUsername, password, newUsername } = req.body;

  if (!currentUsername || !password || !newUsername) {
    return res
      .status(400)
      .json({
        message:
          "All fields (currentUsername, password, newUsername) are required.",
      });
  }

  if (currentUsername === newUsername) {
    return res
      .status(400)
      .json({
        message: "New username cannot be the same as the current username.",
      });
  }

  try {
    const user = await User.findOne({ username: currentUsername });

    if (!user) {
      return res.status(401).json({ message: "Invalid current username." });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ message: "Incorrect password." });
    }

    const existingUserWithNewUsername = await User.findOne({
      username: newUsername,
    });
    if (existingUserWithNewUsername) {
      return res
        .status(409)
        .json({
          message: "New username already taken. Please choose a different one.",
        });
    }

    user.username = newUsername;
    await user.save();

    res.json({ message: "Admin username updated successfully." });
  } catch (error) {
    console.error("Error changing admin username:", error);
    res.status(500).json({ message: "Server error during username change." });
  }
});

// GET /api/software: Retrieve all software entries from MongoDB
app.get("/api/software", async (req, res) => {
  try {
    const software = await Software.find({});
    res.json(software);
  } catch (err) {
    console.error("Error fetching software:", err);
    res.status(500).send("Failed to retrieve software data.");
  }
});

// POST /api/software: Add a new software entry to MongoDB
app.post("/api/software", async (req, res) => {
  try {
    // Mongoose automatically generates _id. We don't need Date.now().toString() anymore.
    const newSoftware = new Software(req.body);
    await newSoftware.save(); // Save to MongoDB
    res
      .status(201)
      .json({ message: "Software added successfully", software: newSoftware });
  } catch (err) {
    console.error("Error adding software:", err);
    // Check for validation errors (e.g., missing required fields)
    if (err.name === "ValidationError") {
      return res.status(400).json({ message: err.message });
    }
    res.status(500).send("Failed to add software.");
  }
});

// PUT /api/software/:id: Update an existing software entry in MongoDB by _id
app.put("/api/software/:id", async (req, res) => {
  try {
    // req.params.id will now be the MongoDB _id
    const updatedSoftware = await Software.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!updatedSoftware) {
      return res.status(404).send("Software not found.");
    }
    res.json({
      message: `Software ${req.params.id} updated successfully`,
      software: updatedSoftware,
    });
  } catch (err) {
    console.error("Error updating software:", err);
    if (err.name === "ValidationError") {
      return res.status(400).json({ message: err.message });
    }
    // Handle CastError specifically if the _id format is invalid
    if (err.name === "CastError") {
      return res
        .status(400)
        .json({ message: `Invalid software ID format: ${req.params.id}` });
    }
    res.status(500).send("Failed to update software.");
  }
});

// DELETE /api/software/:id: Delete a software entry from MongoDB by _id
app.delete("/api/software/:id", async (req, res) => {
  try {
    // req.params.id will now be the MongoDB _id
    const deletedSoftware = await Software.findByIdAndDelete(req.params.id);

    if (!deletedSoftware) {
      return res.status(404).send("Software not found.");
    }
    res.json({ message: `Software ${req.params.id} deleted successfully` });
  } catch (err) {
    console.error("Error deleting software:", err);
    // Handle CastError specifically if the _id format is invalid
    if (err.name === "CastError") {
      return res
        .status(400)
        .json({ message: `Invalid software ID format: ${req.params.id}` });
    }
    res.status(500).send("Failed to delete software.");
  }
});

// Start the server and listen for incoming requests
app.listen(PORT, () => {
  console.log(`Server running on Port ${PORT}`);
});
