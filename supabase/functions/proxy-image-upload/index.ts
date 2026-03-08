import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'authorization, content-type',
      },
    });
  }

  try {
    const { source_url, species_common_name } = await req.json();

    if (!source_url || !species_common_name) {
      return new Response(
        JSON.stringify({ error: 'Missing source_url or species_common_name' }),
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

    const imageBlob = await imageResponse.blob();
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

    // Update species_profiles with the self-hosted storage URL
    const { error: updateError } = await supabase
      .from('species_profiles')
      .update({ image_url: publicUrl, updated_at: new Date().toISOString() })
      .eq('species_common_name', species_common_name);

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
