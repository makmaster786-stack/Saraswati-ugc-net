const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// The Admin model definition
const AdminSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
});
const Admin = mongoose.model('Admin', AdminSchema);

const createAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB connected for admin creation...');

    // --- Set your desired admin credentials here ---
    const email = 'mak@admin.com';
    const password = 'Mayank';
    // ---------------------------------------------

    const existingAdmin = await Admin.findOne({ email });
    if (existingAdmin) {
      console.log('Admin user already exists.');
      mongoose.connection.close();
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newAdmin = new Admin({ email, password: hashedPassword });
    await newAdmin.save();

    console.log('✅ Admin user created successfully!');

  } catch (error) {
    console.error('Error creating admin user:', error);
  } finally {
    mongoose.connection.close();
  }
};

createAdmin();