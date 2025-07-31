import os
import shutil

# Define target directory and file extensions
target_dir = 'txt'
extensions = ('.html', '.css', '.js', '.json')

# Create target directory if it doesn't exist
if not os.path.exists(target_dir):
    os.makedirs(target_dir)

# Process all files in current directory
for filename in os.listdir('.'):
    # Skip directories and non-target files
    if not os.path.isfile(filename):
        continue
        
    # Check file extension
    if filename.lower().endswith(extensions):
        # Create new filename with .txt extension
        base_name = os.path.splitext(filename)[0]
        new_filename = f"{base_name}.txt"
        
        # Define source and destination paths
        src_path = os.path.join('.', filename)
        dst_path = os.path.join(target_dir, new_filename)
        
        # Copy file with new name
        shutil.copy2(src_path, dst_path)
        print(f"Copied: {filename} -> {dst_path}")

print("\nOperation completed successfully!")