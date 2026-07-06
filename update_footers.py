import os
import re

html_files = []
for root, dirs, files in os.walk(r'c:\Users\Hacker\Downloads\EXTRACTS\OFFICIALS\DKUTSERVICES\hostel'):
    for file in files:
        if file.endswith('.html'):
            html_files.append(os.path.join(root, file))

def update_footer(content):
    pattern = r'<p>&copy; 2026 DKUT Hostels\. Verified accommodation services near Dedan Kimathi University of Technology\.</p>'
    replacement = '<p>&copy; 2026 <a href="https://www.dkut.ac.ke/" style="color:inherit;text-decoration:underline;">DKUT</a> Hostels. Verified accommodation services near <a href="https://www.dkut.ac.ke/" style="color:inherit;text-decoration:underline;">Dedan Kimathi</a> University of Technology.<br>Website built and managed by <a href="https://instagram.com/dekutconnect" target="_blank" rel="noopener noreferrer" style="color:inherit;text-decoration:underline;">dekutconnect</a> community.</p>'
    return re.sub(pattern, replacement, content)

for filepath in html_files:
    with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()
    
    new_content = update_footer(content)
    
    if new_content != content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f'Updated footer in {filepath}')
