# WhatsApp Business API – Step-by-Step Setup Guide

This guide explains how to connect your salon billing app to WhatsApp so customers receive bills on their WhatsApp number.

---

## What You Need Before Starting

1. **Facebook/Meta account** (personal Facebook login)
2. **Business phone number** – The number customers will see when they get messages (can be a new SIM)
3. **About 15–20 minutes**

---

## Step 1: Go to Meta for Developers

1. Open a browser and go to: **https://developers.facebook.com**
2. Log in with your Facebook account (or create one)
3. If asked to sign up as a developer, click **Get Started** and complete the steps

---

## Step 2: Create an App

1. In the top-right, click **My Apps**
2. Click **Create App**
3. Choose **Other** → click **Next**
4. Choose **Business** → click **Next**
5. Fill in:
   - **App name:** e.g. `Salon Billing` or `You and I Salon`
   - **App contact email:** your email
   - (Optional) Link to your Business account if you have one
6. Click **Create App**

---

## Step 3: Add WhatsApp to Your App

1. On the app dashboard, find the **Add Products** section
2. Search for or click **WhatsApp**
3. Click **Set up** next to WhatsApp
4. You’ll be taken to the **WhatsApp → API Setup** section

---

## Step 4: Get Phone Number ID and Access Token

### Option A: Use Meta’s Test Number (Quick Start)

1. In **WhatsApp → API Setup**, look at **Step 1: Send and receive messages**
2. You’ll see:
   - **Temporary access token** (valid for 24 hours)
   - **Phone number ID**
   - **Test phone number** (a number Meta gives you)

**To use this for testing:**

- Copy the **Phone number ID** (long number like `123456789012345`)
- Copy the **Temporary access token** (long string)

**Limitation:** With the temporary token, only people you add as “test users” can receive messages. You’ll need to add phone numbers in **Step 5: Add phone numbers** for testing.

---

### Option B: Add Your Own Business Phone (Production)

1. In **WhatsApp → API Setup**, go to **Step 2: Add phone number**
2. Click **Add phone number**
3. Enter your business phone (with country code, e.g. `+91` for India)
4. Meta will send a verification code to that number (SMS or voice call)
5. Enter the code to verify
6. Once verified, that number appears in the list
7. Click on your phone number to see its **Phone number ID** (copy it)

**For the permanent access token:**

1. In the left menu, go to **App Settings → Basic**
2. Find **App Secret** (click Show to reveal it)
3. For a permanent token:
   - Go to **WhatsApp → API Setup**
   - Scroll to **Temporary access token**
   - For production, use a **System User token** (Business Manager) or keep regenerating the temporary one every 24 hours until you set up a permanent token

**Simpler approach for many small businesses:**

- Use the **Temporary access token** from **API Setup**
- Regenerate it every 24 hours from the same page, or
- Use Meta’s instructions to create a **permanent token** with **System User** in Business Manager

---

## Step 5: Add Test Users (If Using Test Number)

1. In **WhatsApp → API Setup**, find **Step 5: Add phone numbers**
2. Click **Manage phone number list**
3. Add the customer phone numbers that should receive test messages (include country code, e.g. `91` then the 10-digit number)
4. Save

---

## Step 6: Add Credentials to Your App

1. Open `server/.env` in your project (create it if it doesn’t exist)
2. Add or update:

```
WA_PHONE_NUMBER_ID=paste_your_phone_number_id_here
WA_ACCESS_TOKEN=paste_your_access_token_here
```

**Example:**

```
WA_PHONE_NUMBER_ID=123456789012345
WA_ACCESS_TOKEN=EAABsbCS1iHgBO7...
```

3. Save the file

---

## Step 7: Restart the Server

1. Stop the server (Ctrl+C in the terminal where it’s running)
2. Start it again:

```bash
cd server
npm start
```

Or, if using dev mode:

```bash
npm run dev
```

---

## Step 8: Test

1. Create a new invoice for a customer who has a phone number
2. Make sure **“Send bill to customer via WhatsApp”** is checked
3. Create the invoice
4. The customer should receive a WhatsApp message with the bill

---

## Troubleshooting

### “WhatsApp not configured”
- Check that `WA_PHONE_NUMBER_ID` and `WA_ACCESS_TOKEN` are in `server/.env`
- Restart the server after changing `.env`

### Messages not received
- **Test number:** Add the recipient as a test user in Meta (Step 5 above)
- **Own number:** The recipient must have messaged your business number at least once in the last 24 hours (for some setups), or your number must be verified for production
- Check `whatsapp_logs` in the database for status (`sent` or `failed`) and error messages

### “Recipient phone number is not registered”
- The customer’s number must be a valid WhatsApp number
- Use the format: 10 digits for India (e.g. `9876543210`), with country code handled by the app

### Token expired
- Temporary tokens last 24 hours
- Go to **WhatsApp → API Setup** and copy the new token into `server/.env`

---

---

## Why Template vs Text? (Important)

**Meta's "Send message" works, but our app didn't** – because:

- **Meta sends a template** (e.g. `hello_world`) – allowed anytime.
- **Our app was sending plain text** – only allowed within 24 hours of the customer's last message.

**WhatsApp rules:**
- **Text messages:** Only within 24h after the customer messages you.
- **Template messages:** Can be sent anytime (business-initiated).

**We now use template messages.** By default we use `hello_world` (sends "Hello World") – this will deliver. For a custom bill message, create an `invoice_bill` template (see below).

---

## Using payment_successful Template (Utility › Payments)

To use Meta's **payment_successful** template (Utility › Payments › Payment successful):

1. In Meta → Your app → **WhatsApp** → **Message templates** → **Create template**
2. Choose **Utility** → **Payments** → **Payment successful** (or select `payment_successful` if listed)
3. The template typically has 4 body parameters. Ensure your template body uses:
   - {{1}} – Invoice/order reference  
   - {{2}} – Description (e.g. "Salon services")  
   - {{3}} – Payment amount (e.g. "₹500.00")  
   - {{4}} – Order ID  
4. Submit for approval
5. Add to `server/.env`: `WA_BILL_TEMPLATE=payment_successful`
6. Restart the server

Our code maps: Invoice number → {{1}}, "Business – services" → {{2}}, Amount → {{3}}, Invoice number → {{4}}.

---

## Custom invoice_bill Template (alternative)

To use a custom template instead:

1. Create template with **Name:** `invoice_bill`, **Category:** Utility  
2. **Body:** `Hi {{1}}, your bill from {{2}}. Invoice: {{3}}. Total: {{4}}. Thank you!`
3. Add to `server/.env`: `WA_BILL_TEMPLATE=invoice_bill`

---

## Links

- **Meta for Developers:** https://developers.facebook.com  
- **WhatsApp Business API docs:** https://developers.facebook.com/docs/whatsapp/cloud-api  
- **Business verification (for production):** https://developers.facebook.com/docs/development/release/business-verification  
