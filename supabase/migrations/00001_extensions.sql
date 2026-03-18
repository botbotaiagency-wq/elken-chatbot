-- Enable pgvector for vector similarity search
create extension if not exists vector with schema extensions;

-- Enable pgtap for database testing
create extension if not exists pgtap with schema extensions;
