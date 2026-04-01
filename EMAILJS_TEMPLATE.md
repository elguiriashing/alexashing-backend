# EmailJS Template Setup Guide

## Template Configuration

Go to EmailJS Dashboard → Email Templates → Create New Template

**Template ID:** `contact_form_template`

**Subject:** `New Contact Form Submission from {{name}}`

**Email Content:**
```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>New Contact Form Submission</title>
    <style>
        body {
            font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #2C3E50;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #F8F9FA;
        }
        .container {
            background-color: #ffffff;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
        }
        .header {
            border-bottom: 2px solid #B08D57;
            padding-bottom: 20px;
            margin-bottom: 20px;
        }
        .header h1 {
            color: #080705;
            font-size: 24px;
            margin: 0;
            font-weight: 600;
        }
        .header p {
            color: #8A8470;
            margin: 10px 0 0 0;
            font-size: 14px;
        }
        .content {
            margin-bottom: 30px;
        }
        .field {
            margin-bottom: 15px;
            padding: 15px;
            background-color: #F8F9FA;
            border-radius: 6px;
            border-left: 3px solid #B08D57;
        }
        .field-label {
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: #8A8470;
            margin-bottom: 5px;
        }
        .field-value {
            font-size: 16px;
            color: #2C3E50;
            word-break: break-word;
        }
        .source-badge {
            display: inline-block;
            padding: 4px 8px;
            background-color: #B08D57;
            color: #080705;
            font-size: 12px;
            font-weight: 500;
            border-radius: 12px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .message-box {
            background-color: #080705;
            color: #F0EAD6;
            padding: 20px;
            border-radius: 8px;
            margin-top: 20px;
        }
        .footer {
            text-align: center;
            padding-top: 20px;
            border-top: 1px solid #E9ECEF;
            font-size: 12px;
            color: #8A8470;
        }
        .footer a {
            color: #B08D57;
            text-decoration: none;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>New Contact Form Submission</h1>
            <p>Someone has reached out through your portfolio website</p>
        </div>
        
        <div class="content">
            <div class="field">
                <div class="field-label">Name</div>
                <div class="field-value">{{name}}</div>
            </div>
            
            <div class="field">
                <div class="field-label">Email</div>
                <div class="field-value">{{email}}</div>
            </div>
            
            {{#phone}}
            <div class="field">
                <div class="field-label">Phone</div>
                <div class="field-value">{{phone}}</div>
            </div>
            {{/phone}}
            
            <div class="field">
                <div class="field-label">Project Type</div>
                <div class="field-value">{{project_type}}</div>
            </div>
            
            <div class="field">
                <div class="field-label">Source Page</div>
                <div class="field-value">
                    <span class="source-badge">{{source}}</span>
                </div>
            </div>
            
            <div class="message-box">
                <div class="field-label" style="color: #F0EAD6; margin-bottom: 10px;">Message</div>
                <div class="field-value" style="color: #F0EAD6;">{{message}}</div>
            </div>
        </div>
        
        <div class="footer">
            <p>Sent from <a href="https://alexashing.com">Alex Ashing Portfolio</a></p>
            <p style="margin-top: 10px; font-size: 11px;">
                This message was sent on {{date}} at {{time}}
            </p>
        </div>
    </div>
</body>
</html>
```

**Template Variables:**
- `{{name}}` - Sender's name
- `{{email}}` - Sender's email
- `{{phone}}` - Sender's phone (optional)
- `{{project_type}}` - Type of project
- `{{source}}` - Which page they came from
- `{{message}}` - The actual message
- `{{date}}` - Current date (auto-added by EmailJS)
- `{{time}}` - Current time (auto-added by EmailJS)

## Final Setup Steps:

1. **Update contact.html:**
   - Replace `template_abcdefg` with `contact_form_template`
   - Your EmailJS is already configured with public key

2. **Create the template in EmailJS:**
   - Copy the HTML content above
   - Set Template ID to: `contact_form_template`
   - Save and activate

3. **Test the system:**
   - Start the backend: `npm install && npm start`
   - Visit: `http://localhost:3000/contact.html?source=music`
   - Submit a test form
   - Check your email for the beautifully formatted message

## Features of This Template:

✅ **Professional Design** - Matches your site's bronze theme
✅ **Responsive** - Works on all devices  
✅ **Source Tracking** - Shows which page they came from
✅ **Conditional Fields** - Phone only shows if provided
✅ **Branded** - Your name and colors throughout
✅ **Organized** - Clear information hierarchy
✅ **Timestamps** - Auto-added date and time

Your contact system will send beautifully formatted, professional emails that perfectly match your brand aesthetic!
