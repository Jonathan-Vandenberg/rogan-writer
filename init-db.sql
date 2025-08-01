-- Enable the pgvector extension for vector operations
CREATE EXTENSION IF NOT EXISTS vector;

-- Create a schema for the application
CREATE SCHEMA IF NOT EXISTS public;

-- Grant permissions
GRANT ALL ON SCHEMA public TO rogan_user;
GRANT ALL ON ALL TABLES IN SCHEMA public TO rogan_user;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO rogan_user;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO rogan_user; 