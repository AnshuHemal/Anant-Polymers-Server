const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const crypto = require('crypto');
const helmet = require("helmet");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  res.locals.nonce = crypto.randomBytes(16).toString("base64");
  next();
});

app.use(
  helmet.contentSecurityPolicy({
    useDefaults: true,
    directives: {
      "default-src": ["'self'"],
      "script-src": [
        "'self'",
        (req, res) => `'nonce-${res.locals.nonce}'`, // allow scripts with this nonce
        "https://cdnjs.cloudflare.com",
        "https://cdn.jsdelivr.net",
      ],
      "style-src": [
        "'self'",
        "'unsafe-inline'", // keep this for now since you have inline CSS
        "https://fonts.googleapis.com",
        "https://cdn.jsdelivr.net",
      ],
      "font-src": ["'self'", "https://fonts.gstatic.com"],
      "img-src": ["'self'", "data:", "https:"],
      "connect-src": ["'self'", "https://anant-server.vercel.app"], // allow API requests
    },
  })
);

const otpStore = new Map();

const transporter = nodemailer.createTransport({
  service: 'gmail', 
  auth: {
    user: process.env.EMAIL_USER, 
    pass: process.env.EMAIL_PASS 
  }
});

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendOTPEmail(email, otp) {
  const mailOptions = {
    from: 'admin@anantpolymers.com',
    to: email,
    subject: 'OTP Verification - Anant Polymers Contact Form',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">OTP Verification</h2>
        <p>Thank you for contacting Anant Polymers. Please use the following OTP to verify your email address:</p>
        <div style="background-color: #f4f4f4; padding: 20px; text-align: center; margin: 20px 0;">
          <h1 style="color: #007bff; font-size: 32px; margin: 0; letter-spacing: 5px;">${otp}</h1>
        </div>
        <p>This OTP is valid for 10 minutes. If you didn't request this, please ignore this email.</p>
        <hr style="margin: 30px 0;">
        <p style="color: #666; font-size: 14px;">
          Anant Polymers<br>
          A-65, Swastik industrial park, Kuha, Ahmedabad, BHARAT (India)<br>
          Phone: +91 79902 46779
        </p>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    return false;
  }
}

async function sendContactEmail(formData) {
  const mailOptions = {
    from: 'noreply@anantpolymers.com',
    to: 'sales@anantpolymers.com', 
    subject: `Contact Form: ${formData.subject} - Anant Polymers`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">New Contact Form Submission</h2>
        <div style="background-color: #f9f9f9; padding: 20px; border-radius: 5px;">
          <p><strong>Name:</strong> ${formData.name}</p>
          <p><strong>Email:</strong> ${formData.email}</p>
          <p><strong>Subject:</strong> ${formData.subject}</p>
          <p><strong>Message:</strong></p>
          <p style="background-color: white; padding: 15px; border-radius: 3px; border-left: 4px solid #007bff;">
            ${formData.message.replace(/\n/g, '<br>')}
          </p>
        </div>
        <hr style="margin: 30px 0;">
        <p style="color: #666; font-size: 14px;">
          This message was sent from the Anant Polymers contact form.
        </p>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error('Error sending contact email:', error);
    return false;
  }
}

async function sendEnquiryEmail(enquiryData) {
  const mailOptions = {
    from: 'noreply@anantpolymers.com',
    to: 'sales@anantpolymers.com', 
    subject: 'New Enquiry - Anant Polymers',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">New Product Enquiry</h2>
        <div style="background-color: #f9f9f9; padding: 20px; border-radius: 5px;">
          <p><strong>Name:</strong> ${enquiryData.name}</p>
          <p><strong>Email:</strong> ${enquiryData.email}</p>
          <p><strong>Phone:</strong> ${enquiryData.phone}</p>
          <p><strong>Product Interest:</strong> ${enquiryData.product}</p>
          <p><strong>Message:</strong></p>
          <p style="background-color: white; padding: 15px; border-radius: 3px; border-left: 4px solid #ed5145;">
            ${enquiryData.message.replace(/\n/g, '<br>')}
          </p>
        </div>
        <hr style="margin: 30px 0;">
        <p style="color: #666; font-size: 14px;">
          This enquiry was sent from the Anant Polymers website popup form.
        </p>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error('Error sending enquiry email:', error);
    return false;
  }
}


app.post('/api/send-otp', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    const otp = generateOTP();
    const otpId = crypto.randomUUID();
    
    otpStore.set(otpId, {
      otp,
      email,
      expiresAt: Date.now() + 10 * 60 * 1000 
    });

    const emailSent = await sendOTPEmail(email, otp);
    
    if (emailSent) {
      res.json({ 
        success: true, 
        message: 'OTP sent successfully',
        otpId: otpId
      });
    } else {
      res.status(500).json({ 
        success: false, 
        message: 'Failed to send OTP email' 
      });
    }
  } catch (error) {
    console.error('Error in send-otp:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
});

app.post('/api/verify-otp', async (req, res) => {
  try {
    const { otpId, otp } = req.body;
    
    if (!otpId || !otp) {
      return res.status(400).json({ 
        success: false, 
        message: 'OTP ID and OTP are required' 
      });
    }

    const storedData = otpStore.get(otpId);
    
    if (!storedData) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid or expired OTP' 
      });
    }

    if (Date.now() > storedData.expiresAt) {
      otpStore.delete(otpId);
      return res.status(400).json({ 
        success: false, 
        message: 'OTP has expired' 
      });
    }

    if (storedData.otp !== otp) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid OTP' 
      });
    }

    storedData.verified = true;
    otpStore.set(otpId, storedData);

    res.json({ 
      success: true, 
      message: 'OTP verified successfully' 
    });
  } catch (error) {
    console.error('Error in verify-otp:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
});

app.post('/api/submit-contact', async (req, res) => {
  try {
    const { otpId, name, email, subject, message } = req.body;
    
    if (!otpId || !name || !email || !subject || !message) {
      return res.status(400).json({ 
        success: false, 
        message: 'All fields are required' 
      });
    }

    const storedData = otpStore.get(otpId);
    
    if (!storedData || !storedData.verified) {
      return res.status(400).json({ 
        success: false, 
        message: 'OTP not verified' 
      });
    }

    if (Date.now() > storedData.expiresAt) {
      otpStore.delete(otpId);
      return res.status(400).json({ 
        success: false, 
        message: 'OTP has expired' 
      });
    }

    const emailSent = await sendContactEmail({ name, email, subject, message });
    
    if (emailSent) {
      otpStore.delete(otpId);
      
      res.json({ 
        success: true, 
        message: 'Contact form submitted successfully' 
      });
    } else {
      res.status(500).json({ 
        success: false, 
        message: 'Failed to submit contact form' 
      });
    }
  } catch (error) {
    console.error('Error in submit-contact:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
});

app.post('/api/submit-enquiry', async (req, res) => {
  try {
    const { name, email, phone, product, message } = req.body;
    
    if (!name || !email || !phone || !product || !message) {
      return res.status(400).json({ 
        success: false, 
        message: 'All fields are required' 
      });
    }

    const emailSent = await sendEnquiryEmail({ name, email, phone, product, message });
    
    if (emailSent) {
      res.json({ 
        success: true, 
        message: 'Enquiry submitted successfully' 
      });
    } else {
      res.status(500).json({ 
        success: false, 
        message: 'Failed to submit enquiry' 
      });
    }
  } catch (error) {
    console.error('Error in submit-enquiry:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
});

setInterval(() => {
  const now = Date.now();
  for (const [otpId, data] of otpStore.entries()) {
    if (now > data.expiresAt) {
      otpStore.delete(otpId);
    }
  }
}, 5 * 60 * 1000);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('Make sure to set EMAIL_USER and EMAIL_PASS environment variables');
});