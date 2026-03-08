-- Create public storage bucket for plant photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('plant-photos', 'plant-photos', true);

-- Public read access
CREATE POLICY "Public read access for plant photos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'plant-photos');

-- Authenticated users can upload to their own folder
CREATE POLICY "Users can upload their own plant photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'plant-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Authenticated users can update their own photos
CREATE POLICY "Users can update their own plant photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'plant-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
