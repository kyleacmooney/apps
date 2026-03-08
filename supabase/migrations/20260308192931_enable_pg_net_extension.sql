-- Enable pg_net for async HTTP requests (used by proxy-image-upload edge function trigger)
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
