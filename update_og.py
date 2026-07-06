import os

def insert_og_tags(filepath):
    with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()
    
    if '<meta property="og:image:width"' in content:
        return # Already injected
    
    # We want to insert them after og:image
    target = '<meta property="og:image" content="https://i.postimg.cc/rFY2qLtR/Gemini-Generated-Image-ie2z3kie2z3kie2z.png" />'
    new_tags = '\n  <meta property="og:image:width" content="1200" />\n  <meta property="og:image:height" content="630" />\n  <meta property="og:image:type" content="image/png" />\n  <meta property="og:site_name" content="DKUT Hostels" />'
    
    if target in content:
        new_content = content.replace(target, target + new_tags)
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f'Updated OG tags in {filepath}')

html_files = []
for root, dirs, files in os.walk(r'c:\Users\Hacker\Downloads\EXTRACTS\OFFICIALS\DKUTSERVICES\hostel'):
    for file in files:
        if file.endswith('.html'):
            html_files.append(os.path.join(root, file))

for filepath in html_files:
    insert_og_tags(filepath)
