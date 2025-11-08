"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Type, AlignLeft, Settings, RotateCcw, Mic } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { SpeechToTextProvider } from "@/hooks/use-speech-to-text"

interface TypographySettings {
  fontFamily: string
  fontSize: number
  lineHeight: number
  pageWidth: number
  pageHeight: number
  marginTop: number
  marginBottom: number
  marginLeft: number
  marginRight: number
  // Chapter title settings
  chapterTitleFontFamily: string
  chapterTitleFontSize: number
  chapterTitleAlignment: 'left' | 'center' | 'right'
  chapterTitlePadding: number
  showChapterTitle: boolean
  // Speech-to-text settings
  speechToTextEnabled: boolean
  speechToTextProvider: SpeechToTextProvider
  speechToTextLanguage: string
  speechToTextAutoInsert: boolean
}

interface TypographyControlsProps {
  settings: TypographySettings
  onSettingsChange: (settings: TypographySettings) => void
  className?: string
}

const FONT_FAMILIES = [
  { value: "Verdana", label: "Verdana", category: "sans-serif" },
  { value: "Garamond", label: "Garamond", category: "serif" },
  { value: "Times New Roman", label: "Times New Roman", category: "serif" },
]

// Trade Paperback (6x9) is the only supported format
const TRADE_PAPERBACK_FORMAT = { name: "Trade Paperback", width: 6, height: 9, description: "Standard fiction" }

export function TypographyControls({ 
  settings, 
  onSettingsChange, 
  className 
}: TypographyControlsProps) {
  const [isExpanded, setIsExpanded] = React.useState(false)

  const handleSettingChange = (key: keyof TypographySettings, value: number | string | boolean) => {
    onSettingsChange({
      ...settings,
      [key]: value
    })
  }

  // Page format is fixed to Trade Paperback (6x9) - no user selection needed

  const resetToDefaults = () => {
    onSettingsChange({
      fontFamily: "Verdana",
      fontSize: 12,
      lineHeight: 1.5,
      pageWidth: 6,
      pageHeight: 9,
      marginTop: 0.7,
      marginBottom: 0.7,
      marginLeft: 1,
      marginRight: 1,
      chapterTitleFontFamily: "Verdana",
      chapterTitleFontSize: 18,
      chapterTitleAlignment: 'center',
      chapterTitlePadding: 20,
      showChapterTitle: true,
      speechToTextEnabled: false,
      speechToTextProvider: 'webspeech',
      speechToTextLanguage: 'en-US',
      speechToTextAutoInsert: true,
    })
  }

  // No format selection needed - always Trade Paperback

  return (
    <div className={className + " bg-card rounded-lg border border-border py-3"}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Type className="h-4 w-4" />
            <CardTitle className="text-sm">Typography & Layout</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="h-7 px-2"
            >
              <Settings className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Quick Info */}
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary" className="text-xs">
            {settings.fontFamily}
          </Badge>
          <Badge variant="secondary" className="text-xs">
            {settings.fontSize}pt
          </Badge>
          <Badge variant="secondary" className="text-xs">
            {settings.pageWidth}×{settings.pageHeight}
          </Badge>
        </div>

        {isExpanded && (
          <>
            <Separator />

            {/* Font Family */}
            <div className="space-y-2">
              <Label className="text-xs font-medium">Font Family</Label>
              <Select
                value={settings.fontFamily}
                onValueChange={(value) => handleSettingChange("fontFamily", value)}
              >
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FONT_FAMILIES.map((font) => (
                    <SelectItem key={font.value} value={font.value}>
                      <span style={{ fontFamily: font.value }}>{font.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Font Size */}
            <div className="space-y-2">
              <div className="flex justify-between">
                <Label className="text-xs font-medium">Font Size</Label>
                <span className="text-xs text-muted-foreground">{settings.fontSize}pt</span>
              </div>
              <Slider
                value={[settings.fontSize]}
                onValueChange={(values: number[]) => handleSettingChange("fontSize", values[0])}
                min={8}
                max={24}
                step={1}
                className="w-full"
              />
            </div>

            {/* Line Height */}
            <div className="space-y-2">
              <div className="flex justify-between">
                <Label className="text-xs font-medium">Line Height</Label>
                <span className="text-xs text-muted-foreground">{settings.lineHeight}</span>
              </div>
              <Slider
                value={[settings.lineHeight]}
                onValueChange={(values: number[]) => handleSettingChange("lineHeight", values[0])}
                min={1}
                max={3}
                step={0.1}
                className="w-full"
              />
            </div>

            <Separator />

            {/* Chapter Title Settings */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium">Chapter Title</Label>
                <Button
                  variant={settings.showChapterTitle ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleSettingChange("showChapterTitle", !settings.showChapterTitle)}
                  className="h-6 px-2 text-xs"
                >
                  {settings.showChapterTitle ? "Shown" : "Hidden"}
                </Button>
              </div>

              {settings.showChapterTitle && (
                <>
                  {/* Chapter Title Font Family */}
                  <div className="space-y-2">
                    <Label className="text-xs font-medium">Chapter Title Font</Label>
                    <Select
                      value={settings.chapterTitleFontFamily}
                      onValueChange={(value) => handleSettingChange("chapterTitleFontFamily", value)}
                    >
                      <SelectTrigger className="h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FONT_FAMILIES.map((font) => (
                          <SelectItem key={font.value} value={font.value}>
                            <span style={{ fontFamily: font.value }}>{font.label}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Chapter Title Font Size */}
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <Label className="text-xs font-medium">Chapter Title Size</Label>
                      <span className="text-xs text-muted-foreground">{settings.chapterTitleFontSize}pt</span>
                    </div>
                    <Slider
                      value={[settings.chapterTitleFontSize]}
                      onValueChange={(values: number[]) => handleSettingChange("chapterTitleFontSize", values[0])}
                      min={12}
                      max={36}
                      step={1}
                      className="w-full"
                    />
                  </div>

                  {/* Chapter Title Alignment */}
                  <div className="space-y-2">
                    <Label className="text-xs font-medium">Chapter Title Alignment</Label>
                    <div className="flex gap-1">
                      {(['left', 'center', 'right'] as const).map((align) => (
                        <Button
                          key={align}
                          variant={settings.chapterTitleAlignment === align ? "default" : "outline"}
                          size="sm"
                          onClick={() => handleSettingChange("chapterTitleAlignment", align)}
                          className="h-8 px-3 flex-1 capitalize"
                        >
                          {align}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {/* Chapter Title Padding */}
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <Label className="text-xs font-medium">Chapter Title Bottom Spacing</Label>
                      <span className="text-xs text-muted-foreground">{settings.chapterTitlePadding}px</span>
                    </div>
                    <Slider
                      value={[settings.chapterTitlePadding]}
                      onValueChange={(values: number[]) => handleSettingChange("chapterTitlePadding", values[0])}
                      min={10}
                      max={80}
                      step={5}
                      className="w-full"
                    />
                  </div>
                </>
              )}
            </div>

            {/* Page Format is hardcoded to Trade Paperback (6x9) - no UI needed */}

            {/* Custom Dimensions removed - only Trade Paperback (6x9) supported */}

            <Separator />

            {/* Margins */}
            <div className="space-y-3">
              <Label className="text-xs font-medium">Margins</Label>
                            <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label className="text-xs">Top</Label>
                    <span className="text-xs text-muted-foreground">{settings.marginTop}</span>
                  </div>
                  <Slider
                    value={[settings.marginTop]}
                    onValueChange={(values: number[]) => handleSettingChange("marginTop", values[0])}
                    min={0.5}
                    max={2}
                    step={0.1}
                    className="w-full"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label className="text-xs">Left</Label>
                    <span className="text-xs text-muted-foreground">{settings.marginLeft}</span>
                  </div>
                  <Slider
                    value={[settings.marginLeft]}
                    onValueChange={(values: number[]) => handleSettingChange("marginLeft", values[0])}
                    min={0.5}
                    max={2}
                    step={0.1}
                    className="w-full"
                  />
                </div>
                <div className="space-y-2 col-span-1">
                  <div className="flex justify-between">
                    <Label className="text-xs">Right</Label>
                    <span className="text-xs text-muted-foreground">{settings.marginRight}</span>
                  </div>
                  <Slider
                    value={[settings.marginRight]}
                    onValueChange={(values: number[]) => handleSettingChange("marginRight", values[0])}
                    min={0.5}
                    max={2}
                    step={0.1}
                    className="w-full"
                  />
                </div>
              </div>
            </div>

            {/* <Separator /> */}

            {/* Speech-to-Text Settings */}
            <div className="space-y-3">
              {/* <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Mic className="h-4 w-4" />
                  <Label className="text-xs font-medium">Speech-to-Text</Label>
                </div>
                <Switch
                  checked={settings.speechToTextEnabled}
                  onCheckedChange={(checked) => handleSettingChange("speechToTextEnabled", checked)}
                />
              </div> */}

              {settings.speechToTextEnabled && (
                <>
                  {/* Provider Selection */}
                  {/* <div className="space-y-2">
                    <Label className="text-xs font-medium">Speech Recognition Provider</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant={settings.speechToTextProvider === 'webspeech' ? "default" : "outline"}
                        size="sm"
                        onClick={() => handleSettingChange("speechToTextProvider", 'webspeech')}
                        className="h-auto p-2 flex flex-col items-center text-xs"
                      >
                        <div className="font-medium">Web Speech</div>
                        <div className="text-xs text-muted-foreground">Browser built-in</div>
                      </Button>
                      <Button
                        variant={settings.speechToTextProvider === 'openai-whisper' ? "default" : "outline"}
                        size="sm"
                        onClick={() => handleSettingChange("speechToTextProvider", 'openai-whisper')}
                        className="h-auto p-2 flex flex-col items-center text-xs"
                      >
                        <div className="font-medium">OpenAI Whisper</div>
                        <div className="text-xs text-muted-foreground">High accuracy</div>
                      </Button>
                    </div>
                  </div> */}

                  {/* Language Selection */}
                  {/* <div className="space-y-2">
                    <Label className="text-xs font-medium">Language</Label>
                    <Select
                      value={settings.speechToTextLanguage}
                      onValueChange={(value) => handleSettingChange("speechToTextLanguage", value)}
                    >
                      <SelectTrigger className="h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="en-US">English (US)</SelectItem>
                        <SelectItem value="en-GB">English (UK)</SelectItem>
                        <SelectItem value="es-ES">Spanish</SelectItem>
                        <SelectItem value="fr-FR">French</SelectItem>
                        <SelectItem value="de-DE">German</SelectItem>
                        <SelectItem value="it-IT">Italian</SelectItem>
                        <SelectItem value="pt-BR">Portuguese (Brazil)</SelectItem>
                        <SelectItem value="ru-RU">Russian</SelectItem>
                        <SelectItem value="ja-JP">Japanese</SelectItem>
                        <SelectItem value="ko-KR">Korean</SelectItem>
                        <SelectItem value="zh-CN">Chinese (Simplified)</SelectItem>
                        <SelectItem value="ar-SA">Arabic</SelectItem>
                        <SelectItem value="hi-IN">Hindi</SelectItem>
                      </SelectContent>
                    </Select>
                  </div> */}

                  {/* Auto-insert Option */}
                  {/* <div className="flex items-center justify-between">
                    <Label className="text-xs font-medium">Auto-insert text</Label>
                    <Switch
                      checked={settings.speechToTextAutoInsert}
                      onCheckedChange={(checked) => handleSettingChange("speechToTextAutoInsert", checked)}
                    />
                  </div> */}
                  
                  {/* {!settings.speechToTextAutoInsert && (
                    <div className="text-xs text-muted-foreground">
                      Speech will be transcribed but you'll need to manually insert it
                    </div>
                  )} */}
                </>
              )}
            </div>
          </>
        )}
      </CardContent>
    </div>
  )
} 