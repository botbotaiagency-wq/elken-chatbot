-- Add subcategory (free-text) to documents table
-- Allows fine-grained classification within a category
-- e.g. Category: Beauty → Subcategory: Skincare

ALTER TABLE public.documents ADD COLUMN subcategory text;
