// @deno-types="https://deno.land/std@0.190.0/http/server.ts"
// This file is designed for Supabase Edge Functions (Deno runtime)
// TypeScript errors in local development are expected and can be ignored
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { userId, guildId } = await req.json()
    
    console.log('Discord membership verification request:', { userId, guildId });

    if (!userId || !guildId) {
      console.log('Missing parameters:', { userId, guildId });
      return new Response(
        JSON.stringify({ error: 'Missing required parameters: userId, guildId' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Get Discord bot token from environment
    const botToken = Deno.env.get('DISCORD_BOT_TOKEN')
    console.log('Bot token available:', !!botToken);
    
    if (!botToken) {
      console.log('Discord bot token not configured');
      return new Response(
        JSON.stringify({ error: 'Discord bot token not configured' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Check if user is a member of the Discord server
    const discordApiUrl = `https://discord.com/api/v10/guilds/${guildId}/members/${userId}`;
    console.log('Calling Discord API:', discordApiUrl);
    console.log('Full Discord API URL:', discordApiUrl);
    console.log('Bot token length:', botToken ? botToken.length : 0);
    console.log('Bot token starts with:', botToken ? botToken.substring(0, 10) + '...' : 'N/A');
    
    const discordResponse = await fetch(discordApiUrl, {
      headers: {
        'Authorization': `Bot ${botToken}`,
        'Content-Type': 'application/json',
      },
    })
    
    console.log('Discord API response status:', discordResponse.status);
    console.log('Discord API response headers:', Object.fromEntries(discordResponse.headers.entries()));

    if (!discordResponse.ok) {
      if (discordResponse.status === 404) {
        return new Response(
          JSON.stringify({ 
            isMember: false, 
            message: 'User not found in server. Please join the Discord server first.' 
          }),
          { 
            status: 200, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }
      
      return new Response(
        JSON.stringify({ 
          isMember: false, 
          error: 'Failed to verify Discord membership' 
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // User is a member of the server
    const memberData = await discordResponse.json()
    
    return new Response(
      JSON.stringify({ 
        isMember: true,
        message: 'Discord membership verified successfully!',
        memberData: {
          username: memberData.user?.username,
          discriminator: memberData.user?.discriminator,
          joinedAt: memberData.joined_at,
          roles: memberData.roles || []
        }
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Error verifying Discord membership:', error)
    return new Response(
      JSON.stringify({ 
        isMember: false, 
        error: 'Internal server error during membership verification' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
