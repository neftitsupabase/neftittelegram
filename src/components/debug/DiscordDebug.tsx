import React, { useState } from 'react';
import { useAuthState } from '@/hooks/useAuthState';
import { useUserConnections } from '@/hooks/useUserConnections';
import DiscordVerificationService from '@/services/DiscordVerificationService';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

export default function DiscordDebug() {
  const { walletAddress } = useAuthState();
  const { connections, loading } = useUserConnections(walletAddress || '');
  const [testUserId, setTestUserId] = useState('');
  const [testResults, setTestResults] = useState<any>(null);
  const [isTesting, setIsTesting] = useState(false);

  const testDiscordMembership = async () => {
    if (!testUserId) {
      toast.error('Please enter a Discord user ID');
      return;
    }

    setIsTesting(true);
    try {
      const result = await DiscordVerificationService.verifyDiscordMembership(testUserId);
      setTestResults({ type: 'membership', result });
      console.log('Membership test result:', result);
    } catch (error) {
      console.error('Membership test error:', error);
      setTestResults({ type: 'membership', error: error });
    } finally {
      setIsTesting(false);
    }
  };

  const testDiscordRole = async () => {
    if (!testUserId) {
      toast.error('Please enter a Discord user ID');
      return;
    }

    setIsTesting(true);
    try {
      const result = await DiscordVerificationService.verifyDiscordRole(testUserId);
      setTestResults({ type: 'role', result });
      console.log('Role test result:', result);
    } catch (error) {
      console.error('Role test error:', error);
      setTestResults({ type: 'role', error: error });
    } finally {
      setIsTesting(false);
    }
  };

  const testBoth = async () => {
    if (!testUserId) {
      toast.error('Please enter a Discord user ID');
      return;
    }

    setIsTesting(true);
    try {
      const result = await DiscordVerificationService.verifyDiscordComplete(testUserId);
      setTestResults({ type: 'both', result });
      console.log('Complete test result:', result);
    } catch (error) {
      console.error('Complete test error:', error);
      setTestResults({ type: 'both', error: error });
    } finally {
      setIsTesting(false);
    }
  };

  const testDiscordAPI = async () => {
    setIsTesting(true);
    try {
      const result = await DiscordVerificationService.testDiscordAPI();
      setTestResults({ type: 'api_test', result });
      console.log('API test result:', result);
    } catch (error) {
      console.error('API test error:', error);
      setTestResults({ type: 'api_test', error: error });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Discord Verification Debug</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="testUserId">Discord User ID to Test:</Label>
            <Input
              id="testUserId"
              value={testUserId}
              onChange={(e) => setTestUserId(e.target.value)}
              placeholder="Enter Discord user ID (e.g., 123456789012345678)"
            />
          </div>

          <div className="flex gap-2">
            <Button onClick={testDiscordMembership} disabled={isTesting}>
              Test Membership
            </Button>
            <Button onClick={testDiscordRole} disabled={isTesting}>
              Test Role
            </Button>
            <Button onClick={testBoth} disabled={isTesting}>
              Test Both
            </Button>
            <Button onClick={testDiscordAPI} disabled={isTesting}>
              Test Discord API
            </Button>
          </div>

          {isTesting && <div>Testing...</div>}

          {testResults && (
            <div className="mt-4 p-4 bg-gray-100 rounded">
              <h3 className="font-semibold mb-2">
                Test Results ({testResults.type})
              </h3>
              <pre className="text-sm overflow-auto">
                {JSON.stringify(testResults, null, 2)}
              </pre>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Current User Discord Connection</CardTitle>
        </CardHeader>
                 <CardContent>
           {loading ? (
             <div>Loading connections...</div>
           ) : (
             <div className="space-y-2">
               <div><strong>Wallet Address:</strong> {walletAddress || 'Not connected'}</div>
               <div><strong>Discord Connection:</strong></div>
               <pre className="text-sm bg-gray-100 p-2 rounded overflow-auto">
                 {JSON.stringify(
                   connections?.linked_social_accounts.find(acc => acc.provider === 'discord'),
                   null,
                   2
                 )}
               </pre>
             </div>
           )}
         </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Discord Service Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div><strong>Guild ID:</strong> {DiscordVerificationService.getGuildId()}</div>
            <div><strong>Role ID:</strong> {DiscordVerificationService.getRoleId()}</div>
            <div><strong>Invite Link:</strong> {DiscordVerificationService.getDiscordInviteLink()}</div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
