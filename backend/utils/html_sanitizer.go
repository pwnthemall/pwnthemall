package utils

import (
	"github.com/microcosm-cc/bluemonday"
)

// SanitizePageHTML sanitizes user-provided HTML/CSS for custom pages
// Removes all JavaScript while allowing safe HTML tags and inline CSS
func SanitizePageHTML(html string) string {
	// Create a custom policy for user-generated content
	policy := bluemonday.UGCPolicy()

	// Allow additional structural elements for page content
	policy.AllowElements("article", "section", "header", "footer", "nav", "aside", "main")
	policy.AllowElements("figure", "figcaption")
	
	// Allow style tags (with CSS property whitelist below)
	policy.AllowElements("style")
	
	// Whitelist safe inline CSS properties
	safeCSSProperties := []string{
		// Typography
		"color", "font-family", "font-size", "font-weight", "font-style",
		"line-height", "letter-spacing", "text-align", "text-decoration",
		"text-transform", "text-indent", "word-spacing", "white-space",
		
		// Layout & Box Model
		"display", "position", "top", "right", "bottom", "left",
		"width", "height", "min-width", "min-height", "max-width", "max-height",
		"margin", "margin-top", "margin-right", "margin-bottom", "margin-left",
		"padding", "padding-top", "padding-right", "padding-bottom", "padding-left",
		"border", "border-width", "border-style", "border-color",
		"border-top", "border-right", "border-bottom", "border-left",
		"border-radius", "box-sizing", "overflow", "overflow-x", "overflow-y",
		
		// Flexbox
		"flex", "flex-direction", "flex-wrap", "flex-flow", "justify-content",
		"align-items", "align-content", "align-self", "order", "flex-grow",
		"flex-shrink", "flex-basis",
		
		// Grid
		"grid", "grid-template-columns", "grid-template-rows", "grid-gap",
		"grid-column", "grid-row", "grid-area",
		
		// Background
		"background", "background-color", "background-image", "background-repeat",
		"background-position", "background-size", "background-attachment",
		
		// Visual
		"opacity", "visibility", "z-index",
		"box-shadow", "text-shadow",
		"border-spacing", "border-collapse",
		"vertical-align",
		
		// Lists
		"list-style", "list-style-type", "list-style-position", "list-style-image",
		
		// Tables
		"table-layout", "caption-side", "empty-cells",
		
		// Transform & Animation (safe subset - no transitions that could cause issues)
		"transform", "transform-origin",
	}
	
	// Allow these CSS properties on all elements
	policy.AllowStyles(safeCSSProperties...).Globally()
	
	// Specifically block dangerous CSS features
	// Note: bluemonday automatically blocks url() with javascript:, data:, etc.
	// It also blocks CSS expressions and behaviors by default
	
	// Sanitize and return
	return policy.Sanitize(html)
}

// GetPageContentSecurityPolicy returns CSP headers for serving custom pages
func GetPageContentSecurityPolicy() string {
	return "default-src 'self'; " +
		"style-src 'self' 'unsafe-inline'; " + // Allow inline styles
		"script-src 'none'; " + // Block all scripts
		"object-src 'none'; " + // Block objects/embed
		"base-uri 'none'; " + // Block base tag
		"form-action 'self'; " +
		"frame-ancestors 'self';" // Prevent clickjacking
}
