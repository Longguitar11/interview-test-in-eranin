const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json());

// Mock data for username/password validation
const users = {
  hoanglong: {
    password: '123456',
    mfaSecret: '', // This will hold the user's TOTP secret
    mfaEnabled: false, // Flag to check if MFA is enabled for the user
  },
};

// Secret keys for JWT tokens
const LONG_TOKEN_SECRET = 'longTokenSecret';
const SHORT_TOKEN_SECRET = 'shortTokenSecret';

// Middleware to protect routes
const authenticateJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader) {
    const token = authHeader.split(' ')[1];
    jwt.verify(token, SHORT_TOKEN_SECRET, (err, user) => {
      if (err) // If the token is expired, send 401 Unauthorized
      return res.status(401).send('Token expired or invalid');

      req.user = user;
      next();
    });
  } else {
    res.sendStatus(401);
  }
};

// Generate QR Code for MFA Setup
app.post('/setup-mfa', (req, res) => {
  const { username } = req.body;

  if (!users[username]) {
    return res.status(404).send('User not found');
  }

  // Generate a TOTP secret for the user
  const secret = speakeasy.generateSecret({ name: `MyApp (${username})` });
  users[username].mfaSecret = secret.base32;

  // Generate a QR code for the user to scan with Google Authenticator
  qrcode.toDataURL(secret.otpauth_url, (err, dataUrl) => {
    if (err) {
      return res.status(500).send('Failed to generate QR code');
    }

    res.json({ qrCodeUrl: dataUrl });
  });
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;

  // Validate username and password
  if (users[username] && users[username].password === password) {
    // If MFA is enabled, require MFA code
    if (users[username].mfaEnabled) {
      res.json({ mfaRequired: true, mfaEnabled: true, username });
    } else {
      // If MFA is not enabled, return the need for setup
      res.json({ mfaRequired: true, mfaEnabled: false, username });
    }
  } else {
    res.status(401).send('Invalid credentials');
  }
});

// Verify MFA and issue tokens
app.post('/verify-mfa', (req, res) => {
  const { username, mfaCode } = req.body;

  const user = users[username];

  const verified = speakeasy.totp.verify({
    secret: user.mfaSecret,
    encoding: 'base32',
    token: mfaCode,
  });

  if (verified) {
    // Mark the user as having MFA enabled (for first-time setup)
    user.mfaEnabled = true;

    const shortToken = jwt.sign({ username }, SHORT_TOKEN_SECRET, {
      expiresIn: '1m',
    });
    const longToken = jwt.sign({ username }, LONG_TOKEN_SECRET, {
      expiresIn: '7d',
    });

    res.json({ success: true, shortToken, longToken });
  } else {
    res.status(401).json({ error: 'Invalid OTP' });
  }
});

// Get username (protected route)
app.get('/get-username', authenticateJWT, (req, res) => {
  const user = users[req.user.username];

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  res.json({ username: req.user.username });
});

// Disable MFA
app.post('/disable-mfa', authenticateJWT, (req, res) => {
  const user = users[req.user.username];

  if(!user) {
    return res.status(404).json({error: 'User not found'});
  }

  user.mfaEnabled = false;
  res.json({ success: true });
});

// Route to refresh the short token using the long token
app.post('/refresh-token', (req, res) => {
  const { longToken } = req.body;

  // Verify the long token
  jwt.verify(longToken, LONG_TOKEN_SECRET, (err, user) => {
    if (err) {
      return res.status(401).send('Invalid or expired long token');
    }

    // If long token is valid, issue a new short token
    const newShortToken = jwt.sign({ username: user.username }, SHORT_TOKEN_SECRET, {
      expiresIn: '1m', // New short token expires in 15 minutes
    });

    res.json({ shortToken: newShortToken });
  });
});


app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
