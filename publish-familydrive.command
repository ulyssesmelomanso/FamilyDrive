#!/bin/zsh
set -e

cd "$(dirname "$0")"

echo "FamilyDrive publish helper"
echo "=========================="
echo ""
echo "This will commit the current dashboard fixes and push them to:"
echo "https://github.com/ulyssesmelomanso/FamilyDrive.git"
echo ""

git remote set-url origin https://github.com/ulyssesmelomanso/FamilyDrive.git
git add .

if git diff --cached --quiet; then
  echo "No local changes to commit."
else
  git commit -m "Update FamilyDrive July dashboard import"
fi

echo ""
echo "Pushing to GitHub..."
git push -u origin main

echo ""
echo "Done. GitHub has the latest FamilyDrive dashboard."
echo "If Vercel is connected to this repo, it should start deploying automatically."
read -k 1 "?Press any key to close..."
