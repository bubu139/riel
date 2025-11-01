
'use client';

import { useState } from 'react';
import { useAuth } from '@/firebase';
import { useRouter } from 'next/navigation';
import { initiateEmailSignIn, initiateEmailSignUp } from '@/firebase/non-blocking-login';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { onAuthStateChanged, AuthError } from 'firebase/auth';

export default function LoginPage() {
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const auth = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  useState(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        toast({ title: "Đăng nhập thành công!" });
        router.push('/');
      }
      // Handle loading state if needed
    }, (error) => {
      setIsLoading(false);
      const authError = error as AuthError;
      toast({
        variant: "destructive",
        title: "Ôi, có lỗi!",
        description: authError.message || "Đã có lỗi xảy ra.",
      });
    });

    return () => unsubscribe();
  }, [auth, router, toast]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    initiateEmailSignIn(auth, loginEmail, loginPassword);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    initiateEmailSignUp(auth, signupEmail, signupPassword);
  };

  return (
    <main className="flex flex-col items-center justify-center h-full w-full p-4">
      <Tabs defaultValue="login" className="w-full max-w-sm">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="login">Đăng nhập</TabsTrigger>
          <TabsTrigger value="signup">Đăng ký</TabsTrigger>
        </TabsList>
        <TabsContent value="login">
          <form onSubmit={handleLogin}>
            <Card>
              <CardHeader>
                <CardTitle>Đăng nhập</CardTitle>
                <CardDescription>
                  Chào mừng trở lại! Đăng nhập để tiếp tục.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email">Email</Label>
                  <Input 
                    id="login-email" 
                    type="email" 
                    placeholder="m@example.com" 
                    required 
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    disabled={isLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">Mật khẩu</Label>
                  <Input 
                    id="login-password" 
                    type="password" 
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)} 
                    disabled={isLoading}
                  />
                </div>
              </CardContent>
              <CardFooter>
                <Button className="w-full" type="submit" disabled={isLoading}>
                  {isLoading ? 'Đang xử lý...' : 'Đăng nhập'}
                </Button>
              </CardFooter>
            </Card>
          </form>
        </TabsContent>
        <TabsContent value="signup">
          <form onSubmit={handleSignUp}>
            <Card>
              <CardHeader>
                <CardTitle>Đăng ký</CardTitle>
                <CardDescription>
                  Tạo tài khoản mới để lưu lại tiến trình học tập.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input 
                    id="signup-email" 
                    type="email" 
                    placeholder="m@example.com" 
                    required
                    value={signupEmail}
                    onChange={(e) => setSignupEmail(e.target.value)}
                    disabled={isLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Mật khẩu</Label>
                  <Input 
                    id="signup-password" 
                    type="password" 
                    required
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    disabled={isLoading}
                  />
                </div>
              </CardContent>
              <CardFooter>
                <Button className="w-full" type="submit" disabled={isLoading}>
                  {isLoading ? 'Đang xử lý...' : 'Tạo tài khoản'}
                </Button>
              </CardFooter>
            </Card>
          </form>
        </TabsContent>
      </Tabs>
    </main>
  );
}
