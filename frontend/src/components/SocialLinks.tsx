import React from 'react';
import { Github, Twitter, Linkedin, Globe, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface SocialLinksData {
  github?: string;
  twitter?: string;
  linkedin?: string;
  discord?: string;
  website?: string;
}

interface SocialLinksProps {
  links: SocialLinksData;
  size?: 'sm' | 'md' | 'lg';
}

export function SocialLinks({ links, size = 'md' }: SocialLinksProps) {
  const iconSize = size === 'sm' ? 16 : size === 'md' ? 20 : 24;
  const buttonSize = size === 'sm' ? 'sm' : 'default';
  
  const hasAnyLink = links && (links.github || links.twitter || links.linkedin || links.discord || links.website);
  
  if (!hasAnyLink) {
    return null;
  }
  
  return (
    <TooltipProvider>
      <div className="flex items-center gap-2 flex-wrap">
        {links.github && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="h-10 w-10"
                asChild
              >
                <a
                  href={links.github}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="GitHub Profile"
                >
                  <Github size={iconSize} />
                </a>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>GitHub</p>
            </TooltipContent>
          </Tooltip>
        )}
        
        {links.twitter && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="h-10 w-10"
                asChild
              >
                <a
                  href={links.twitter}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Twitter Profile"
                >
                  <Twitter size={iconSize} />
                </a>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Twitter</p>
            </TooltipContent>
          </Tooltip>
        )}
        
        {links.linkedin && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="h-10 w-10"
                asChild
              >
                <a
                  href={links.linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="LinkedIn Profile"
                >
                  <Linkedin size={iconSize} />
                </a>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>LinkedIn</p>
            </TooltipContent>
          </Tooltip>
        )}
        
        {links.discord && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="h-10 w-10"
                asChild
              >
                <span aria-label={`Discord: ${links.discord}`}>
                  <MessageCircle size={iconSize} />
                </span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Discord: {links.discord}</p>
            </TooltipContent>
          </Tooltip>
        )}
        
        {links.website && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="h-10 w-10"
                asChild
              >
                <a
                  href={links.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Personal Website"
                >
                  <Globe size={iconSize} />
                </a>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Website</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
}
