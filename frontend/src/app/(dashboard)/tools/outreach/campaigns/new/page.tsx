'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { api } from '@/lib/api/client';
import { cn } from '@/lib/utils';
import type { Lead } from '@/lib/api/types';

// SVG Icons
const ArrowLeftIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 256 256">
    <path d="M224,128a8,8,0,0,1-8,8H59.31l58.35,58.34a8,8,0,0,1-11.32,11.32l-72-72a8,8,0,0,1,0-11.32l72-72a8,8,0,0,1,11.32,11.32L59.31,120H216A8,8,0,0,1,224,128Z"/>
  </svg>
);

const SparkleIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 256 256">
    <path d="M208,144a15.78,15.78,0,0,1-10.42,14.94l-51.65,19-19,51.61a15.92,15.92,0,0,1-29.88,0L78,178l-51.62-19a15.92,15.92,0,0,1,0-29.88l51.65-19,19-51.61a15.92,15.92,0,0,1,29.88,0l19,51.65,51.61,19A15.78,15.78,0,0,1,208,144ZM152,48h16V64a8,8,0,0,0,16,0V48h16a8,8,0,0,0,0-16H184V16a8,8,0,0,0-16,0V32H152a8,8,0,0,0,0,16Zm88,32h-8V72a8,8,0,0,0-16,0v8h-8a8,8,0,0,0,0,16h8v8a8,8,0,0,0,16,0V96h8a8,8,0,0,0,0-16Z"/>
  </svg>
);

export default function NewCampaignPage() {
  const router = useRouter();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [step, setStep] = useState(1);

  const [form, setForm] = useState({
    name: '',
    pitch: '',
    tone: 'professional' as 'professional' | 'casual' | 'friendly',
    subjectTemplate: '',
    bodyTemplate: '',
    trackOpens: true,
    trackClicks: true,
  });

  useEffect(() => {
    const fetchLeads = async () => {
      try {
        // Get all leads except unsubscribed ones
        const data = await api.getLeads();
        // Filter out unsubscribed leads on client side
        const availableLeads = (data || []).filter(l => l.status !== 'unsubscribed');
        setLeads(availableLeads);
      } catch {
        toast.error('Failed to load leads');
      } finally {
        setIsLoading(false);
      }
    };
    fetchLeads();
  }, []);

  const handleGenerateTemplate = async () => {
    if (!form.pitch.trim()) {
      toast.error('Please describe what you want to communicate');
      return;
    }

    setIsGenerating(true);
    try {
      const template = await api.generateEmailTemplate({
        pitch: form.pitch,
        tone: form.tone,
      });
      setForm(prev => ({
        ...prev,
        subjectTemplate: template.subjectTemplate,
        bodyTemplate: template.bodyTemplate,
      }));
      toast.success('Template generated');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to generate template';
      toast.error(message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCreate = async () => {
    if (!form.name.trim()) {
      toast.error('Please enter a campaign name');
      return;
    }
    if (!form.subjectTemplate.trim() || !form.bodyTemplate.trim()) {
      toast.error('Please generate or write an email template');
      return;
    }
    if (selectedLeads.size === 0) {
      toast.error('Please select at least one lead');
      return;
    }

    setIsCreating(true);
    try {
      // Create campaign
      const campaign = await api.createCampaign({
        name: form.name,
        subjectTemplate: form.subjectTemplate,
        bodyTemplate: form.bodyTemplate,
        trackOpens: form.trackOpens,
        trackClicks: form.trackClicks,
      });

      // Generate emails for selected leads
      await api.generateCampaignEmails(campaign.id, Array.from(selectedLeads));

      toast.success('Campaign created');
      router.push(`/tools/outreach/campaigns/${campaign.id}`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to create campaign';
      toast.error(message);
    } finally {
      setIsCreating(false);
    }
  };

  const toggleLead = (leadId: string) => {
    setSelectedLeads(prev => {
      const next = new Set(prev);
      if (next.has(leadId)) {
        next.delete(leadId);
      } else {
        next.add(leadId);
      }
      return next;
    });
  };

  const selectAll = () => {
    if (selectedLeads.size === leads.length) {
      setSelectedLeads(new Set());
    } else {
      setSelectedLeads(new Set(leads.map(l => l.id)));
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-4"
      >
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeftIcon />
        </Button>
        <div>
          <h1 className="font-serif text-2xl font-medium tracking-tight">
            Create Campaign
          </h1>
          <p className="text-sm text-muted-foreground">
            Step {step} of 3
          </p>
        </div>
      </motion.div>

      {/* Step 1: Campaign Details & Template */}
      {step === 1 && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="space-y-6"
        >
          <Card className="border-border/40">
            <CardHeader>
              <CardTitle className="text-lg">Campaign Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Campaign Name *</Label>
                <Input
                  placeholder="e.g., Product Launch Outreach"
                  value={form.name}
                  onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/40">
            <CardHeader>
              <CardTitle className="text-lg">Email Template</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>What do you want to communicate? *</Label>
                <textarea
                  className="w-full min-h-[100px] px-3 py-2 text-sm rounded-md border border-input bg-background"
                  placeholder="Describe your pitch, value proposition, and what you want recipients to do..."
                  value={form.pitch}
                  onChange={(e) => setForm(prev => ({ ...prev, pitch: e.target.value }))}
                />
              </div>

              <div className="flex items-center gap-4">
                <div className="space-y-2 flex-1">
                  <Label>Tone</Label>
                  <Select
                    value={form.tone}
                    onValueChange={(v) => setForm(prev => ({ ...prev, tone: v as typeof form.tone }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="professional">Professional</SelectItem>
                      <SelectItem value="casual">Casual</SelectItem>
                      <SelectItem value="friendly">Friendly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button 
                  onClick={handleGenerateTemplate} 
                  disabled={isGenerating || !form.pitch.trim()}
                  className="mt-6"
                >
                  {isGenerating ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <SparkleIcon />
                      <span className="ml-1.5">Generate Template</span>
                    </>
                  )}
                </Button>
              </div>

              {form.subjectTemplate && (
                <>
                  <div className="space-y-2">
                    <Label>Subject Line</Label>
                    <Input
                      value={form.subjectTemplate}
                      onChange={(e) => setForm(prev => ({ ...prev, subjectTemplate: e.target.value }))}
                    />
                    <p className="text-xs text-muted-foreground">
                      Variables: {'{{companyName}}'}, {'{{contactName}}'}, {'{{contactTitle}}'}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Email Body</Label>
                    <textarea
                      className="w-full min-h-[200px] px-3 py-2 text-sm rounded-md border border-input bg-background font-mono"
                      value={form.bodyTemplate}
                      onChange={(e) => setForm(prev => ({ ...prev, bodyTemplate: e.target.value }))}
                    />
                  </div>
                </>
              )}

              <div className="flex items-center justify-between pt-4 border-t">
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={form.trackOpens}
                      onCheckedChange={(v) => setForm(prev => ({ ...prev, trackOpens: v }))}
                    />
                    <Label className="text-sm">Track opens</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={form.trackClicks}
                      onCheckedChange={(v) => setForm(prev => ({ ...prev, trackClicks: v }))}
                    />
                    <Label className="text-sm">Track clicks</Label>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button 
              onClick={() => setStep(2)}
              disabled={!form.name.trim() || !form.subjectTemplate.trim()}
            >
              Next: Select Leads
            </Button>
          </div>
        </motion.div>
      )}

      {/* Step 2: Select Leads */}
      {step === 2 && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="space-y-6"
        >
          <Card className="border-border/40">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Select Leads</CardTitle>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{selectedLeads.size} selected</Badge>
                  <Button variant="outline" size="sm" onClick={selectAll}>
                    {selectedLeads.size === leads.length ? 'Deselect All' : 'Select All'}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : leads.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">No leads available. Discover some leads first.</p>
                  <Button variant="outline" className="mt-4" onClick={() => router.push('/tools/outreach')}>
                    Go to Outreach
                  </Button>
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-2 pr-4">
                    {leads.map((lead) => (
                      <div
                        key={lead.id}
                        className={cn(
                          "p-3 rounded-lg border cursor-pointer transition-all",
                          selectedLeads.has(lead.id)
                            ? "border-primary bg-primary/5"
                            : "border-border/40 hover:border-primary/30"
                        )}
                        onClick={() => toggleLead(lead.id)}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{lead.companyName}</p>
                            <p className="text-sm text-muted-foreground">
                              {lead.contactName || 'No contact'} 
                              {lead.contactEmail && ` • ${lead.contactEmail}`}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {lead.leadScore > 0 && (
                              <Badge variant="secondary" className="text-xs">
                                {lead.leadScore}%
                              </Badge>
                            )}
                            <div className={cn(
                              "w-5 h-5 rounded border-2 flex items-center justify-center",
                              selectedLeads.has(lead.id)
                                ? "border-primary bg-primary text-white"
                                : "border-muted-foreground/30"
                            )}>
                              {selectedLeads.has(lead.id) && (
                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" viewBox="0 0 256 256">
                                  <path d="M229.66,77.66l-128,128a8,8,0,0,1-11.32,0l-56-56a8,8,0,0,1,11.32-11.32L96,188.69,218.34,66.34a8,8,0,0,1,11.32,11.32Z"/>
                                </svg>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button 
              onClick={() => setStep(3)}
              disabled={selectedLeads.size === 0}
            >
              Next: Review
            </Button>
          </div>
        </motion.div>
      )}

      {/* Step 3: Review & Create */}
      {step === 3 && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="space-y-6"
        >
          <Card className="border-border/40">
            <CardHeader>
              <CardTitle className="text-lg">Review Campaign</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Campaign Name</p>
                  <p className="font-medium">{form.name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Recipients</p>
                  <p className="font-medium">{selectedLeads.size} leads</p>
                </div>
              </div>

              <div>
                <p className="text-sm text-muted-foreground mb-1">Subject</p>
                <p className="font-medium">{form.subjectTemplate}</p>
              </div>

              <div>
                <p className="text-sm text-muted-foreground mb-1">Preview</p>
                <div className="p-4 rounded-lg bg-muted/50 text-sm whitespace-pre-wrap">
                  {form.bodyTemplate}
                </div>
              </div>

              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span>Track opens: {form.trackOpens ? 'Yes' : 'No'}</span>
                <span>Track clicks: {form.trackClicks ? 'Yes' : 'No'}</span>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(2)}>
              Back
            </Button>
            <Button onClick={handleCreate} disabled={isCreating}>
              {isCreating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Creating...
                </>
              ) : (
                'Create Campaign'
              )}
            </Button>
          </div>
        </motion.div>
      )}
    </div>
  );
}
