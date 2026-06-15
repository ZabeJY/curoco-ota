"""
Generate app icon with proper safe area padding.
- Canvas: 1024x1024 white background
- Logo scaled to 60% of canvas width (614px)
- Centered with 20% padding on each side
- Ensures logo doesn't overflow when system applies rounded corners
"""

from PIL import Image

CANVAS_SIZE = 1024
LOGO_SCALE = 0.60  # 60% of canvas = safe for Android squircle (max allowed)
LOGO_SIZE = int(CANVAS_SIZE * LOGO_SCALE)  # 614px
PADDING = (CANVAS_SIZE - LOGO_SIZE) // 2  # 205px each side

print(f"Canvas: {CANVAS_SIZE}x{CANVAS_SIZE}")
print(f"Logo target: {LOGO_SIZE}x{LOGO_SIZE}")
print(f"Padding: {PADDING}px each side ({PADDING/CANVAS_SIZE*100:.1f}%)")

# Open and resize logo
logo = Image.open("logo.png").convert("RGBA")
logo = logo.resize((LOGO_SIZE, LOGO_SIZE), Image.LANCZOS)

# Create white canvas and paste centered
canvas = Image.new("RGBA", (CANVAS_SIZE, CANVAS_SIZE), (255, 255, 255, 255))
canvas.paste(logo, (PADDING, PADDING), logo)

# Save as icon.png (convert to RGB for compatibility)
canvas = canvas.convert("RGB")
canvas.save("icon.png", "PNG")

print("✅ icon.png generated successfully")
print(f"   Logo width: {LOGO_SIZE}px ({LOGO_SCALE*100}% of canvas)")
print(f"   Padding: {PADDING}px each side ({PADDING/CANVAS_SIZE*100:.1f}%)")
