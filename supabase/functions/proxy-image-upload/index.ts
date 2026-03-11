import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'authorization, content-type, x-api-key',
      },
    });
  }

  // ── Auth: API key check ──────────────────────────────────────
  const expectedKey = Deno.env.get('PROXY_UPLOAD_API_KEY');
  const providedKey = req.headers.get('x-api-key');
  if (!expectedKey || providedKey !== expectedKey) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } },
    );
  }

  try {
    const { source_url, species_common_name, user_id } = await req.json();

    if (!source_url || !species_common_name || !user_id) {
      return new Response(
        JSON.stringify({ error: 'Missing source_url, species_common_name, or user_id' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    // ── Input validation ──────────────────────────────────────
    if (typeof source_url !== 'string' || !source_url.startsWith('https://')) {
      return new Response(
        JSON.stringify({ error: 'source_url must be an HTTPS URL' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    // Download the image from the source URL
    const imageResponse = await fetch(source_url);
    if (!imageResponse.ok) {
      return new Response(
        JSON.stringify({ error: `Failed to download image: ${imageResponse.status}` }),
        { status: 502, headers: { 'Content-Type': 'application/json' } },
      );
    }

    // ── Size check ────────────────────────────────────────────
    const contentLength = imageResponse.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > MAX_IMAGE_BYTES) {
      return new Response(
        JSON.stringify({ error: 'Image exceeds 5 MB limit' }),
        { status: 413, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const imageBlob = await imageResponse.blob();
    if (imageBlob.size > MAX_IMAGE_BYTES) {
      return new Response(
        JSON.stringify({ error: 'Image exceeds 5 MB limit' }),
        { status: 413, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';
    const ext = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg';

    const slug = slugify(species_common_name);
    const storagePath = `species/${slug}.${ext}`;

    // Create Supabase client with service role key for storage + DB access
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Upload to storage (upsert to overwrite if exists)
    const { error: uploadError } = await supabase.storage
      .from('plant-photos')
      .upload(storagePath, imageBlob, {
        contentType,
        upsert: true,
      });

    if (uploadError) {
      return new Response(
        JSON.stringify({ error: `Upload failed: ${uploadError.message}` }),
        { status: 500, headers: { 'Content-Type': 'application/json' } },
      );
    }

    // Get the public URL for the uploaded image
    const { data: { publicUrl } } = supabase.storage
      .from('plant-photos')
      .getPublicUrl(storagePath);

    // Update species_profiles scoped to this user
    const { error: updateError } = await supabase
      .from('species_profiles')
      .update({ image_url: publicUrl, updated_at: new Date().toISOString() })
      .eq('species_common_name', species_common_name)
      .eq('user_id', user_id);

    if (updateError) {
      return new Response(
        JSON.stringify({ error: `DB update failed: ${updateError.message}`, publicUrl }),
        { status: 500, headers: { 'Content-Type': 'application/json' } },
      );
    }

    return new Response(
      JSON.stringify({ success: true, publicUrl }),
      { headers: { 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
});
