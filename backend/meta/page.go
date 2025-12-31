package meta

// PageMetadata represents the metadata stored in page.yml
type PageMetadata struct {
	Title       string `yaml:"title"`
	IsInSidebar bool   `yaml:"is_in_sidebar"`
	Order       int    `yaml:"order"`
}
