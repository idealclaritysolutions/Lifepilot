import { useState, useCallback } from 'react'

// Google Calendar integration
// For full OAuth, you'd need a Google Cloud project + client ID
// For MVP, we support:
// 1. Generating .ics files for "Add to Calendar" buttons
// 2. Google Calendar URL scheme for quick adds
// 3. Future: Full OAuth with Google Calendar API

export interface CalendarEvent {
  title: string
  description?: string
  startDate: string  // YYYY-MM-DD
  startTime?: string // HH:MM
  endTime?: string   // HH:MM
  location?: string
  reminder?: number  // minutes before
}

export function useCalendar() {
  const [connected, setConnected] = useState(false)

  // Generate Google Calendar "quick add" URL
  const getGoogleCalUrl = useCallback((event: CalendarEvent): string => {
    const start = event.startTime
      ? `${event.startDate.replace(/-/g, '')}T${event.startTime.replace(':', '')}00`
      : event.startDate.replace(/-/g, '')
    
    const end = event.endTime
      ? `${event.startDate.replace(/-/g, '')}T${event.endTime.replace(':', '')}00`
      : start

    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: event.title,
      dates: `${start}/${end}`,
    })
    
    if (event.description) params.set('details', event.description)
    if (event.location) params.set('location', event.location)

    return `https://calendar.google.com/calendar/render?${params.toString()}`
  }, [])

  // Generate Apple Calendar / Outlook .ics file content
  const generateICS = useCallback((event: CalendarEvent): string => {
    const uid = `lifepilot-${Date.now()}@lifepilot.app`
    const now = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
    
    const startDt = event.startTime
      ? `${event.startDate.replace(/-/g, '')}T${event.startTime.replace(':', '')}00`
      : event.startDate.replace(/-/g, '')
    
    const endDt = event.endTime
      ? `${event.startDate.replace(/-/g, '')}T${event.endTime.replace(':', '')}00`
      : startDt

    const dtType = event.startTime ? 'DTSTART' : 'DTSTART;VALUE=DATE'
    const dtEndType = event.endTime ? 'DTEND' : 'DTEND;VALUE=DATE'

    let ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//LifePilotAI//EN',
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${now}`,
      `${dtType}:${startDt}`,
      `${dtEndType}:${endDt}`,
      `SUMMARY:${event.title}`,
    ]

    if (event.description) ics.push(`DESCRIPTION:${event.description.replace(/\n/g, '\\n')}`)
    if (event.location) ics.push(`LOCATION:${event.location}`)
    if (event.reminder) {
      ics.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${event.title}`, `TRIGGER:-PT${event.reminder}M`, 'END:VALARM')
    }

    ics.push('END:VEVENT', 'END:VCALENDAR')
    return ics.join('\r\n')
  }, [])

  // Download .ics file
  const downloadICS = useCallback((event: CalendarEvent) => {
    const ics = generateICS(event)
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${event.title.replace(/[^a-zA-Z0-9]/g, '_')}.ics`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [generateICS])

  return { connected, getGoogleCalUrl, generateICS, downloadICS }
}
