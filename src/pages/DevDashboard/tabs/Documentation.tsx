/**
 * Documentation Tab
 *
 * Visualizes database schema, user flows, and test cases using Mermaid diagrams
 */

import React, { useState, useEffect, useRef } from 'react'
import mermaid from 'mermaid'
import { databaseSchemaDiagram } from '../diagrams/databaseSchema'
import { authFlowDiagrams } from '../diagrams/authFlows'
import { testCaseData } from '../data/testCases'

// Initialize mermaid
mermaid.initialize({
  startOnLoad: false,
  theme: 'default',
  securityLevel: 'loose',
  fontFamily: 'Inter, system-ui, sans-serif',
})

type DiagramCategory = 'schema' | 'flows' | 'tests'

interface DiagramSection {
  id: string
  title: string
  description: string
  diagram?: string
  content?: React.ReactNode
}

export const Documentation: React.FC = () => {
  const [activeCategory, setActiveCategory] = useState<DiagramCategory>('schema')
  const [selectedDiagram, setSelectedDiagram] = useState<string>('er-diagram')
  const [renderKey, setRenderKey] = useState(0)
  const diagramRef = useRef<HTMLDivElement>(null)

  // Render mermaid diagram when selection changes
  useEffect(() => {
    const renderDiagram = async () => {
      if (!diagramRef.current) return

      try {
        const sections = getSections()
        const section = sections.find(s => s.id === selectedDiagram)
        if (!section?.diagram) return

        // Clear previous content
        diagramRef.current.innerHTML = ''

        // Create a unique ID for this render
        const id = `mermaid-${Date.now()}`

        // Render the diagram
        const { svg } = await mermaid.render(id, section.diagram)
        diagramRef.current.innerHTML = svg
      } catch (error) {
        console.error('Failed to render mermaid diagram:', error)
        if (diagramRef.current) {
          diagramRef.current.innerHTML = `
            <div class="p-4 bg-red-50 border border-red-200 rounded text-red-700">
              <strong>Diagram Error:</strong> Failed to render diagram. Check console for details.
            </div>
          `
        }
      }
    }

    renderDiagram()
  }, [selectedDiagram, renderKey, activeCategory])

  const getSections = (): DiagramSection[] => {
    switch (activeCategory) {
      case 'schema':
        return [
          {
            id: 'er-diagram',
            title: 'Database ER Diagram',
            description: 'Complete entity-relationship diagram showing all tables and relationships',
            diagram: databaseSchemaDiagram.erDiagram,
          },
          {
            id: 'sync-architecture',
            title: 'Sync Architecture',
            description: 'How data flows between IndexedDB and Supabase',
            diagram: databaseSchemaDiagram.syncArchitecture,
          },
        ]
      case 'flows':
        return [
          {
            id: 'signup-email',
            title: 'Sign Up - Email/Password',
            description: 'New user registration with email and password',
            diagram: authFlowDiagrams.signupEmail,
          },
          {
            id: 'signup-google',
            title: 'Sign Up - Google OAuth',
            description: 'New user registration with Google',
            diagram: authFlowDiagrams.signupGoogle,
          },
          {
            id: 'signin-email',
            title: 'Sign In - Email/Password',
            description: 'Returning user login with email and password',
            diagram: authFlowDiagrams.signinEmail,
          },
          {
            id: 'band-creation',
            title: 'Band Creation Flow',
            description: 'Creating a new band after authentication',
            diagram: authFlowDiagrams.bandCreation,
          },
          {
            id: 'band-joining',
            title: 'Band Joining Flow',
            description: 'Joining an existing band with invite code',
            diagram: authFlowDiagrams.bandJoining,
          },
        ]
      case 'tests':
        return [
          {
            id: 'test-overview',
            title: 'Test Coverage Overview',
            description: 'Current test implementation status',
            content: <TestCaseVisualization />,
          },
        ]
      default:
        return []
    }
  }

  const sections = getSections()
  const currentSection = sections.find(s => s.id === selectedDiagram) || sections[0]

  return (
    <div className="flex h-[calc(100vh-250px)]">
      {/* Left Sidebar - Category Selection */}
      <div className="w-64 bg-white border-r border-divider flex flex-col">
        <div className="p-4 border-b border-divider">
          <h3 className="text-sm font-semibold text-muted uppercase tracking-wide">
            Documentation
          </h3>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Categories */}
          <div className="p-2">
            <button
              onClick={() => {
                setActiveCategory('schema')
                setSelectedDiagram('er-diagram')
              }}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeCategory === 'schema'
                  ? 'bg-primary text-white'
                  : 'text-text hover:bg-gray-100'
              }`}
            >
              📊 Database Schema
            </button>
            <button
              onClick={() => {
                setActiveCategory('flows')
                setSelectedDiagram('signup-email')
              }}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors mt-1 ${
                activeCategory === 'flows'
                  ? 'bg-primary text-white'
                  : 'text-text hover:bg-gray-100'
              }`}
            >
              🔄 User Flows
            </button>
            <button
              onClick={() => {
                setActiveCategory('tests')
                setSelectedDiagram('test-overview')
              }}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors mt-1 ${
                activeCategory === 'tests'
                  ? 'bg-primary text-white'
                  : 'text-text hover:bg-gray-100'
              }`}
            >
              ✅ Test Cases
            </button>
          </div>

          {/* Diagram List */}
          {sections.length > 1 && (
            <div className="mt-4 p-2 border-t border-divider">
              <h4 className="text-xs font-semibold text-muted uppercase tracking-wide px-3 mb-2">
                {activeCategory === 'schema' ? 'Diagrams' :
                 activeCategory === 'flows' ? 'Flows' : 'Views'}
              </h4>
              {sections.map((section) => (
                <button
                  key={section.id}
                  onClick={() => setSelectedDiagram(section.id)}
                  className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                    selectedDiagram === section.id
                      ? 'bg-primary-light text-primary font-medium'
                      : 'text-text hover:bg-gray-50'
                  }`}
                >
                  {section.title}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b border-divider p-4">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-bold text-text">{currentSection?.title}</h2>
              <p className="text-sm text-muted mt-1">{currentSection?.description}</p>
            </div>
            <button
              onClick={() => setRenderKey(prev => prev + 1)}
              className="px-3 py-1.5 text-sm bg-white border border-divider rounded hover:bg-gray-50 transition-colors"
              title="Refresh diagram"
            >
              🔄 Refresh
            </button>
          </div>
        </div>

        {/* Diagram or Content Area */}
        <div className="flex-1 overflow-auto p-6">
          {currentSection?.content ? (
            currentSection.content
          ) : (
            <div className="bg-white rounded-lg shadow-sm p-6 border border-divider">
              <div ref={diagramRef} className="mermaid-container" />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Test Case Visualization Component
 */
const TestCaseVisualization: React.FC = () => {
  const categories = testCaseData.categories

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PASS': return 'bg-green-100 text-green-800 border-green-200'
      case 'FAIL': return 'bg-red-100 text-red-800 border-red-200'
      case 'PARTIAL': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'NOT_IMPLEMENTED': return 'bg-gray-100 text-gray-800 border-gray-200'
      case 'IN_PROGRESS': return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'SKIPPED': return 'bg-purple-100 text-purple-800 border-purple-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'PASS': return '✅'
      case 'FAIL': return '❌'
      case 'PARTIAL': return '⚠️'
      case 'NOT_IMPLEMENTED': return '🔲'
      case 'IN_PROGRESS': return '🚧'
      case 'SKIPPED': return '⏭️'
      default: return '❓'
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-divider">
      {/* Summary Cards */}
      <div className="p-6 border-b border-divider">
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="text-2xl font-bold text-green-700">{testCaseData.summary.passing}</div>
            <div className="text-sm text-green-600 mt-1">Passing</div>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="text-2xl font-bold text-red-700">{testCaseData.summary.failing}</div>
            <div className="text-sm text-red-600 mt-1">Failing</div>
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <div className="text-2xl font-bold text-gray-700">{testCaseData.summary.notImplemented}</div>
            <div className="text-sm text-gray-600 mt-1">Not Implemented</div>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="text-2xl font-bold text-blue-700">{testCaseData.summary.total}</div>
            <div className="text-sm text-blue-600 mt-1">Total Tests</div>
          </div>
        </div>

        {/* Coverage Bar */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-muted">Overall Coverage</span>
            <span className="font-semibold text-text">
              {((testCaseData.summary.passing / testCaseData.summary.total) * 100).toFixed(1)}%
            </span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 transition-all duration-300"
              style={{ width: `${(testCaseData.summary.passing / testCaseData.summary.total) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Test Categories */}
      <div className="p-6">
        {categories.map((category) => (
          <div key={category.name} className="mb-6 last:mb-0">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-text">{category.name}</h3>
              <span className="text-sm text-muted">
                {category.tests.filter(t => t.status === 'PASS').length} / {category.tests.length} passing
              </span>
            </div>

            <div className="space-y-2">
              {category.tests.map((test, idx) => (
                <div
                  key={idx}
                  className={`flex items-center gap-3 p-3 rounded-lg border ${getStatusColor(test.status)}`}
                >
                  <span className="text-lg">{getStatusIcon(test.status)}</span>
                  <div className="flex-1">
                    <div className="text-sm font-medium">{test.name}</div>
                    {test.file && (
                      <div className="text-xs text-muted mt-1 font-mono">{test.file}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
