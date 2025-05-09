'use client'

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ApiConfig, CacheMode } from "@superglue/client";
import { composeUrl } from "@/src/lib/utils";
import { Button } from "@/src/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/src/components/ui/card";
import { Badge } from "@/src/components/ui/badge";
import { Play, Clock, AlertCircle, Copy } from "lucide-react";
import { SuperglueClient } from "@superglue/client";
import { useToast } from "@/src/hooks/use-toast";
import { useConfig } from "@/src/app/config-context";

export function ApiPlayground({ configId }: { configId?: string }) {
  const params = useParams();
  const id = configId || params.id as string;
  const { toast } = useToast();
  const [config, setConfig] = useState<ApiConfig | null>(null);
  const [response, setResponse] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [responseTime, setResponseTime] = useState<number | null>(null);
  const [payloadInput, setPayloadInput] = useState("{}");
  const [credentialsInput, setCredentialsInput] = useState("{}");
  const [selectedCacheMode, setSelectedCacheMode] = useState<CacheMode>(CacheMode.READONLY);
  const superglueConfig = useConfig();
  const [templateVars, setTemplateVars] = useState<string[]>([]);

  // Find template variables in a string
  const findTemplateVars = (str: string): string[] => {
    if (!str) return [];
    // Only match {varName} patterns
    const matches = str.match(/\{(\w+)\}/g) || [];
    return matches.map(match => match.slice(1, -1));
  };

  // Save user inputs to sessionStorage instead of localStorage
  const saveUserInputs = () => {
    if (!id) return;
    sessionStorage.setItem(`sg-playground-payload-${id}`, payloadInput);
    sessionStorage.setItem(`sg-playground-credentials-${id}`, credentialsInput);
    sessionStorage.setItem(`sg-playground-cachemode-${id}`, selectedCacheMode);
  };

  // Load user inputs from sessionStorage
  const loadUserInputs = () => {
    if (!id) return;
    const savedPayload = sessionStorage.getItem(`sg-playground-payload-${id}`);
    const savedCredentials = sessionStorage.getItem(`sg-playground-credentials-${id}`);
    const savedCacheMode = sessionStorage.getItem(`sg-playground-cachemode-${id}`);
    
    if (savedPayload) setPayloadInput(savedPayload);
    if (savedCredentials) setCredentialsInput(savedCredentials);
    if (savedCacheMode) setSelectedCacheMode(savedCacheMode as CacheMode);
  };

  // Save inputs when user switches tabs
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        saveUserInputs();
      }
    };

    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', saveUserInputs);
    
    return () => {
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', saveUserInputs);
    };
  }, [id, payloadInput, credentialsInput, selectedCacheMode]);

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const superglueClient = new SuperglueClient({
          endpoint: superglueConfig.superglueEndpoint,
          apiKey: superglueConfig.superglueApiKey
        })
        const data = await superglueClient.getApi(id);
        setConfig(data);
        
        const varMatches = [
          data.urlPath,
          ...Object.values(data.queryParams || {}),
          ...Object.values(data.headers || {}),
          data.body
        ].flatMap(value => findTemplateVars(String(value)));
        setTemplateVars(varMatches);
        const allVars = [...new Set(varMatches)].filter(v => !['limit', 'offset', 'page'].includes(v));
        // Pre-populate credentials with template variables
        if (allVars.length > 0 && credentialsInput === "{}") {
          const prefilledCredentials = Object.fromEntries(
            allVars.map(varName => [varName, ""])
          );
          setCredentialsInput(JSON.stringify(prefilledCredentials, null, 2));
        }
        
        // Load saved user inputs
        loadUserInputs();
      } catch (err) {
        setError('Failed to load API configuration');
        console.error(err);
      }
    };
    loadConfig();
  }, [id]);

  const handleRunApi = async (e: React.MouseEvent) => {
    e.preventDefault();  // Prevent any form submission
    if (!config) return;
    
    // Save inputs before running
    saveUserInputs();
    
    setLoading(true);
    setError(null);
    setResponse(null);
    setResponseTime(null);

    const startTime = Date.now();

    try {
        let parsedPayload = {};
        let parsedCredentials = {};
        
        try {
          parsedPayload = JSON.parse(payloadInput);
          parsedCredentials = JSON.parse(credentialsInput);
        } catch (e) {
          toast({
            title: "Invalid JSON",
            description: "Please check your payload and credentials JSON format",
            variant: "destructive",
          }); 
          throw new Error("Invalid JSON in payload or credentials");
        }

        // Check if all credential variables have values
        const emptyCredentials = Object.entries(parsedCredentials)
          .filter(([key, value]) => value === "")
          .map(([key]) => key);
          
        if (emptyCredentials.length > 0) {
          toast({
            title: "Missing Credentials",
            description: `Please provide values for: ${emptyCredentials.join(', ')}`,
            variant: "destructive",
          });
          throw new Error("Missing credential values");
        }

        const superglue = new SuperglueClient({
            apiKey: superglueConfig.superglueApiKey,
            endpoint: superglueConfig.superglueEndpoint
        })
        const response = await superglue.call({
          id: config.id,
          payload: parsedPayload,
          credentials: parsedCredentials,
          options: {
              cacheMode: selectedCacheMode
          }
        })

        setResponse(response.data);
        setResponseTime(Date.now() - startTime);
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to execute API call';
      setError(errorMessage);
      toast({
        title: "API Call Failed",
        description: errorMessage,
        variant: "destructive",
      });
      if (err.response) {
        setResponse(err.response.data);
      }
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (!config) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Request Section */}
      <div className="space-y-6 lg:mx-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Request Configuration</span>
              <div className="flex gap-2 items-center">
              <Button 
                onClick={handleRunApi}
                disabled={loading}
                size="lg"
                className="gap-2"
              >
                <Play className="h-4 w-4" />
                {loading ? 'Running...' : 'Run API'}
              </Button>
            </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">URL</label>
              <div className="mt-1 p-2 bg-secondary rounded-md flex items-center gap-2">
              <Badge variant={loading ? "secondary" : "default"} className="h-6 justify-center">
                {config.method}
                </Badge>
                {composeUrl(config.urlHost, config.urlPath)}
              </div>
            </div>
            
            <div>
              <label className="text-sm font-medium">Instruction</label>
              <div className="mt-1 p-2 bg-secondary rounded-md">
                {config.instruction}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Payload (JSON)</label>
              <textarea
                className="mt-1 p-2 w-full h-32 font-mono text-sm bg-secondary rounded-md"
                value={payloadInput}
                onChange={(e) => setPayloadInput(e.target.value)}
                placeholder="{}"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Credentials (JSON)</label>
              {templateVars.length > 0 && (
                <div className="mt-1 mb-2 text-xs text-muted-foreground">
                  Found template variables: {templateVars.join(', ')}
                </div>
              )}
              <textarea
                className="mt-1 p-2 w-full h-32 font-mono text-sm bg-secondary rounded-md"
                value={credentialsInput}
                onChange={(e) => setCredentialsInput(e.target.value)}
                placeholder="{}"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Cache Mode</label>
              <select
                className="mt-1 p-2 w-full bg-secondary rounded-md"
                value={selectedCacheMode}
                onChange={(e) => setSelectedCacheMode(e.target.value as CacheMode)}
              >
                <option value={CacheMode.READONLY}>Read Only</option>
                <option value={CacheMode.ENABLED}>Enabled</option>
              </select>
            </div>

          </CardContent>
        </Card>
      </div>

      {/* Response Section */}
      <div className="space-y-6">
        {response ? (
          <Card className="min-h-full">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Response</span>
                <Badge variant={loading ? "secondary" : "default"}>
                  {loading ? "Loading..." : "Success"}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              {responseTime && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                  <Clock className="h-4 w-4" />
                  Response time: {responseTime}ms
                </div>
              )}
              <div className="relative">
                <pre className="bg-secondary p-4 rounded-md overflow-auto text-xs max-h-full">
                  {JSON.stringify(response, null, 2)}
                </pre>
                <Button
                  variant="ghost" 
                  size="sm"
                  className="absolute top-2 right-2"
                  onClick={(e) => {
                    e.preventDefault();
                    navigator.clipboard.writeText(JSON.stringify(response, null, 2));
                  }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              {error && (
                <Card className="border-red-200 bg-red-50 mt-4">
                  <CardHeader>
                    <CardTitle className="text-red-700 flex items-center gap-2">
                      <AlertCircle className="h-5 w-5" />
                      Error
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-red-600">{error}</p>
                  </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card className="min-h-full">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Response</span>
                <Badge variant="secondary">Waiting</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center justify-center text-muted-foreground p-8">
                <Play className="h-12 w-12 mb-4 opacity-50" />
                <p>Run the API to see the response here</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
