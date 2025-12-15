#!/usr/bin/env node
/**
 * Theme Manifest Generator
 * 
 * Scans /public/themes directory for theme JSON files and generates
 * a manifest.json file containing metadata for all available themes.
 * 
 * Run: npm run generate-theme-manifest
 * Or: node scripts/generate-theme-manifest.ts
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ESM dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface ThemeMetadata {
  id: string;
  name: string;
  version: string;
  author: string;
  description: string;
  preview: string;
}

interface ThemeManifest {
  generated: string;
  themes: ThemeMetadata[];
}

const THEMES_DIR = path.join(__dirname, '../public/themes');
const MANIFEST_PATH = path.join(THEMES_DIR, 'manifest.json');

function generateManifest(): void {
  console.log('🎨 Generating theme manifest...\n');

  // Ensure themes directory exists
  if (!fs.existsSync(THEMES_DIR)) {
    console.error(`❌ Themes directory not found: ${THEMES_DIR}`);
    process.exit(1);
  }

  // Read all JSON files in themes directory
  const files = fs.readdirSync(THEMES_DIR)
    .filter(file => file.endsWith('.json') && file !== 'manifest.json' && file !== 'schema.json');

  if (files.length === 0) {
    console.warn('⚠️  No theme files found in themes directory');
    return;
  }

  const themes: ThemeMetadata[] = [];
  const errors: string[] = [];

  // Process each theme file
  for (const file of files) {
    const filePath = path.join(THEMES_DIR, file);
    console.log(`📄 Processing: ${file}`);

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const theme = JSON.parse(content);

      // Validate required fields
      const requiredFields = ['id', 'name', 'version', 'author', 'description'];
      const missingFields = requiredFields.filter(field => !theme[field]);

      if (missingFields.length > 0) {
        errors.push(`${file}: Missing required fields: ${missingFields.join(', ')}`);
        continue;
      }

      // Validate ID format (alphanumeric + hyphens only)
      if (!/^[a-z0-9-]+$/.test(theme.id)) {
        errors.push(`${file}: Invalid theme ID '${theme.id}' - must be lowercase alphanumeric with hyphens only`);
        continue;
      }

      // Validate ID matches filename
      const expectedFilename = `${theme.id}.json`;
      if (file !== expectedFilename) {
        errors.push(`${file}: Theme ID '${theme.id}' doesn't match filename (expected ${expectedFilename})`);
        continue;
      }

      // Check for preview image
      const previewPath = path.join(THEMES_DIR, theme.id, 'preview.jpg');
      const previewPathPng = path.join(THEMES_DIR, theme.id, 'preview.png');
      let previewUrl = `/themes/previews/${theme.id}.jpg`; // Default placeholder

      if (fs.existsSync(previewPath)) {
        previewUrl = `/themes/${theme.id}/preview.jpg`;
      } else if (fs.existsSync(previewPathPng)) {
        previewUrl = `/themes/${theme.id}/preview.png`;
      }

      // Add theme to manifest
      themes.push({
        id: theme.id,
        name: theme.name,
        version: theme.version,
        author: theme.author,
        description: theme.description,
        preview: previewUrl,
      });

      console.log(`   ✅ ${theme.name} (${theme.id})`);
    } catch (error) {
      errors.push(`${file}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Report errors
  if (errors.length > 0) {
    console.error('\n❌ Errors encountered:\n');
    errors.forEach(error => console.error(`   ${error}`));
    process.exit(1);
  }

  // Sort themes alphabetically by name
  themes.sort((a, b) => a.name.localeCompare(b.name));

  // Generate manifest
  const manifest: ThemeManifest = {
    generated: new Date().toISOString(),
    themes,
  };

  // Write manifest file
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf-8');

  console.log(`\n✨ Successfully generated manifest with ${themes.length} theme(s)`);
  console.log(`📝 Manifest saved to: ${MANIFEST_PATH}\n`);
  console.log('Themes included:');
  themes.forEach(theme => {
    console.log(`   • ${theme.name} (${theme.id}) by ${theme.author}`);
  });
}

// Run the generator
try {
  generateManifest();
} catch (error) {
  console.error('❌ Fatal error:', error);
  process.exit(1);
}
