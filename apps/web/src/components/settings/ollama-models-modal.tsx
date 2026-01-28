/**
 * Ollama Models Modal - Manage custom Ollama models
 */

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Loader2, Plus, X } from 'lucide-react'
import { toast } from 'sonner'
import { addOllamaModel, removeOllamaModel, type OllamaModel } from '@/lib/api'

interface OllamaModelsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  models: OllamaModel[]
}

export function OllamaModelsModal({ open, onOpenChange, models }: OllamaModelsModalProps) {
  const queryClient = useQueryClient()
  const [showAddForm, setShowAddForm] = useState(false)
  const [newModelId, setNewModelId] = useState('')
  const [newModelName, setNewModelName] = useState('')
  const [newModelThinking, setNewModelThinking] = useState(false)

  // Add Ollama model mutation
  const addModelMutation = useMutation({
    mutationFn: addOllamaModel,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['llm-providers'] })
      queryClient.invalidateQueries({ queryKey: ['setup-status'] })
      toast.success('Model added')
      resetForm()
    },
    onError: () => {
      toast.error('Failed to add model')
    },
  })

  // Remove Ollama model mutation
  const removeModelMutation = useMutation({
    mutationFn: removeOllamaModel,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['llm-providers'] })
      queryClient.invalidateQueries({ queryKey: ['setup-status'] })
      toast.success('Model removed')
    },
    onError: () => {
      toast.error('Failed to remove model')
    },
  })

  const resetForm = () => {
    setShowAddForm(false)
    setNewModelId('')
    setNewModelName('')
    setNewModelThinking(false)
  }

  const handleAddModel = () => {
    if (!newModelId) return
    addModelMutation.mutate({
      id: newModelId,
      name: newModelName || newModelId,
      supportsThinking: newModelThinking,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ollama Models</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Models list */}
          {models.length > 0 ? (
            <div className="space-y-2">
              {models.map((model) => (
                <div
                  key={model.id}
                  className="flex items-center justify-between py-2 px-3 rounded-lg bg-surface-elevated border border-border-subtle"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{model.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{model.id}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                    onClick={() => removeModelMutation.mutate(model.id)}
                    disabled={removeModelMutation.isPending}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          ) : !showAddForm ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No models added yet. Add a model to get started.
            </p>
          ) : null}

          {/* Add model form */}
          {showAddForm ? (
            <div className="space-y-3 pt-2 border-t border-border-subtle">
              <Input
                placeholder="Model ID (e.g., llama3.2)"
                value={newModelId}
                onChange={(e) => setNewModelId(e.target.value)}
                className="h-10"
              />
              <Input
                placeholder="Display name (e.g., Llama 3.2)"
                value={newModelName}
                onChange={(e) => setNewModelName(e.target.value)}
                className="h-10"
              />
              <div className="flex items-center gap-2">
                <Checkbox
                  id="modal-thinking"
                  checked={newModelThinking}
                  onCheckedChange={(checked) => setNewModelThinking(checked === true)}
                />
                <label htmlFor="modal-thinking" className="text-sm text-muted-foreground">
                  Supports thinking/reasoning
                </label>
              </div>
              <div className="flex gap-2 pt-2">
                <Button variant="ghost" className="flex-1" onClick={resetForm}>
                  Cancel
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleAddModel}
                  disabled={!newModelId || addModelMutation.isPending}
                >
                  {addModelMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    'Add Model'
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="outline" className="w-full" onClick={() => setShowAddForm(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Model
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
