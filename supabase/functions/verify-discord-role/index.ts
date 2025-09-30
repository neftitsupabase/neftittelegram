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
    const { userId, guildId, requiredRoleId } = await req.json()

    console.log('Discord role verification request:', { userId, guildId, requiredRoleId });

    if (!userId || !guildId || !requiredRoleId) {
      console.log('Missing parameters:', { userId, guildId, requiredRoleId });
      return new Response(
        JSON.stringify({ error: 'Missing required parameters: userId, guildId, requiredRoleId' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Get Discord bot token from environment
    const botToken = Deno.env.get('DISCORD_BOT_TOKEN')
    if (!botToken) {
      return new Response(
        JSON.stringify({ error: 'Discord bot token not configured' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Check if user has the required role via Discord API
    const discordApiUrl = `https://discord.com/api/v10/guilds/${guildId}/members/${userId}`;
    console.log('Calling Discord API for role check:', discordApiUrl);
    console.log('Full Discord API URL for role check:', discordApiUrl);
    console.log('Bot token length:', botToken ? botToken.length : 0);
    console.log('Bot token starts with:', botToken ? botToken.substring(0, 10) + '...' : 'N/A');

    const discordResponse = await fetch(discordApiUrl, {
      headers: {
        'Authorization': `Bot ${botToken}`,
        'Content-Type': 'application/json',
      },
    })

    console.log('Discord API response status for role check:', discordResponse.status);
    console.log('Discord API response headers for role check:', Object.fromEntries(discordResponse.headers.entries()));

    if (!discordResponse.ok) {
      if (discordResponse.status === 404) {
        return new Response(
          JSON.stringify({
            hasRole: false,
            error: 'User not found in server. Please join the Discord server first.'
          }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }

      return new Response(
        JSON.stringify({
          hasRole: false,
          error: 'Failed to verify Discord membership'
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const memberData = await discordResponse.json()
    const userRoles = memberData.roles || []
    const hasRole = userRoles.includes(requiredRoleId)

    return new Response(
      JSON.stringify({
        hasRole,
        message: hasRole
          ? 'Role verified successfully!'
          : 'Required role not found. Please ensure you have the correct role in Discord.'
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Error verifying Discord role:', error)
    return new Response(
      JSON.stringify({
        hasRole: false,
        error: 'Internal server error during role verification'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
