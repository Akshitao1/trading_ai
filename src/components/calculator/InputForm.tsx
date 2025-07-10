import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CalendarIcon, DollarSign, Target, Briefcase } from 'lucide-react';
import { TradingInputs } from '@/types/trading';
import { useToast } from '@/hooks/use-toast';

interface InputFormProps {
  onCalculate: (inputs: TradingInputs) => void;
  isLoading: boolean;
}

export const InputForm: React.FC<InputFormProps> = ({ onCalculate, isLoading }) => {
  const { toast } = useToast();
  const [formData, setFormData] = useState<TradingInputs>({
    budget: 0,
    asGoal: 0,
    startDate: '',
    endDate: '',
    cpasGoal: undefined,
    numberOfJobs: undefined
  });
  const [showDurationWarning, setShowDurationWarning] = useState(false);

  const handleInputChange = (field: keyof TradingInputs, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleStartDateChange = (e) => {
    setFormData(prev => ({
      ...prev,
      startDate: e.target.value
    }));
    if (formData.endDate) {
      const days = (new Date(formData.endDate).getTime() - new Date(e.target.value).getTime()) / (1000 * 60 * 60 * 24) + 1;
      setShowDurationWarning(days < 7);
    }
  };

  const handleEndDateChange = (e) => {
    setFormData(prev => ({
      ...prev,
      endDate: e.target.value
    }));
    if (formData.startDate) {
      const days = (new Date(e.target.value).getTime() - new Date(formData.startDate).getTime()) / (1000 * 60 * 60 * 24) + 1;
      setShowDurationWarning(days < 7);
    }
  };

  const isDurationValid = () => {
    if (!formData.startDate || !formData.endDate) return false;
    const days = (new Date(formData.endDate).getTime() - new Date(formData.startDate).getTime()) / (1000 * 60 * 60 * 24) + 1;
    return days >= 7;
  };

  // Helper to get the minimum valid end date based on the selected start date
  const getMinValidEndDate = () => {
    if (!formData.startDate) return '';
    const start = new Date(formData.startDate);
    const minEnd = new Date(start);
    minEnd.setDate(start.getDate() + 6); // +6 because both start and end are included
    return minEnd.toISOString().slice(0, 10);
  };

  const validateForm = (): boolean => {
    if (!formData.budget || formData.budget <= 0) {
      toast({
        title: "Validation Error",
        description: "Budget must be greater than 0",
        variant: "destructive"
      });
      return false;
    }

    if (!formData.asGoal || formData.asGoal <= 0) {
      toast({
        title: "Validation Error", 
        description: "AS Goal must be greater than 0",
        variant: "destructive"
      });
      return false;
    }

    if (!formData.startDate || !formData.endDate) {
      toast({
        title: "Validation Error",
        description: "Both start and end dates are required",
        variant: "destructive"
      });
      return false;
    }

    if (new Date(formData.startDate) >= new Date(formData.endDate)) {
      toast({
        title: "Validation Error",
        description: "End date must be after start date",
        variant: "destructive"
      });
      return false;
    }

    return true;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (validateForm()) {
      onCalculate(formData);
      toast({
        title: "Analysis Started",
        description: "AI model is processing your campaign data...",
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-green-600" />
              Budget Configuration
            </CardTitle>
            <CardDescription>Set your campaign budget and financial goals</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="budget">Campaign Budget ($)</Label>
              <Input
                id="budget"
                type="number"
                placeholder="Enter total budget"
                value={formData.budget || ''}
                onChange={(e) => handleInputChange('budget', parseFloat(e.target.value) || 0)}
                className="mt-1"
                required
              />
              {formData.budget > 0 && formData.budget < 5000 && (
                <div className="text-red-600 text-xs mt-1 font-semibold">
                  Campaign budget must be at least $5,000.
                </div>
              )}
            </div>
            <div>
              <Label htmlFor="cpasGoal">CPAS Goal ($) - Optional</Label>
              <Input
                id="cpasGoal"
                type="number"
                step="0.01"
                placeholder="Target cost per apply start"
                value={formData.cpasGoal || ''}
                onChange={(e) => handleInputChange('cpasGoal', parseFloat(e.target.value) || undefined)}
                className="mt-1"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-blue-600" />
              Performance Goals
            </CardTitle>
            <CardDescription>Define your campaign objectives</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="asGoal">Apply Starts Goal</Label>
              <Input
                id="asGoal"
                type="number"
                placeholder="Target apply starts"
                value={formData.asGoal || ''}
                onChange={(e) => handleInputChange('asGoal', parseInt(e.target.value) || 0)}
                className="mt-1"
                required
              />
            </div>
            <div>
              <Label htmlFor="numberOfJobs">Number of Jobs - Optional</Label>
              <Input
                id="numberOfJobs"
                type="number"
                placeholder="Total job postings"
                value={formData.numberOfJobs || ''}
                onChange={(e) => handleInputChange('numberOfJobs', parseInt(e.target.value) || undefined)}
                className="mt-1"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5 text-purple-600" />
            Campaign Timeline
          </CardTitle>
          <CardDescription>Set your campaign duration</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="startDate">Start Date</Label>
            <Input
              id="startDate"
              type="date"
              value={formData.startDate}
              onChange={handleStartDateChange}
              className="mt-1"
              required
            />
          </div>
          <div>
            <Label htmlFor="endDate">End Date</Label>
            <Input
              id="endDate"
              type="date"
              value={formData.endDate}
              onChange={handleEndDateChange}
              className="mt-1"
              required
              min={formData.startDate}
            />
          </div>
        </CardContent>
      </Card>

      {showDurationWarning && (
        <div className="text-red-600 mt-2 font-semibold">
          Minimum campaign duration is 7 days. End Date &#8805; {getMinValidEndDate()}
        </div>
      )}

      <div className="flex justify-center">
        <Button 
          type="submit" 
          className="px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-lg shadow-lg transform transition-all duration-200 hover:scale-105"
          disabled={!isDurationValid() || isLoading}
        >
          {isLoading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Analyzing Campaign...
            </>
          ) : (
            <>
              <Briefcase className="mr-2 h-4 w-4" />
              Generate AI Analysis
            </>
          )}
        </Button>
      </div>
    </form>
  );
};
