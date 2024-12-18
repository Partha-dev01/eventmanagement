// src/pages/Events/HomePage.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import Navbar from '../../components/Layout/Navbar/Navbar';
import TabButtons from '../../components/TabButtons/TabButtons';
import { toast } from 'react-toastify';
import '../../styles/Components.css';
import '../../styles/OrganizerEvents.css';

const HomePage = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState('upcoming');
  const [events, setEvents] = useState({
    upcoming: [],
    past: [],
    enrolled: [],
    created: []
  });
  const [loading, setLoading] = useState(true);

  const isOrganizer = user?.role === 'Organizer';
  const isAdmin = user?.role === 'Admin';
  const canManageEvents = isOrganizer || isAdmin;

  // Simple function to handle image URLs
  const getValidImageUrl = (imageData, eventId) => {
    if (!imageData) return `https://picsum.photos/seed/${eventId}/800/400`;
    
    if (typeof imageData === 'object') {
      try {
        const url = imageData.data ? imageData.data.toString() : null;
        return url && url.startsWith('http') ? url : `https://picsum.photos/seed/${eventId}/800/400`;
      } catch {
        return `https://picsum.photos/seed/${eventId}/800/400`;
      }
    }
    
    return imageData.startsWith('http') ? imageData : `https://picsum.photos/seed/${eventId}/800/400`;
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    
    if (!token || !storedUser) {
      setActiveTab('upcoming');
    }
  }, [user, isAuthenticated]);

  useEffect(() => {
    const fetchEvents = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('token');
        let endpoint = '';
        let headers = {
          'Content-Type': 'application/json'
        };

        // Add authorization header if token exists
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        // Select endpoint based on active tab
        switch(activeTab) {
          case 'created':
            endpoint = '/api/events/organizer/events';
            break;
          case 'enrolled':
            endpoint = '/api/enroll/events';
            break;
          case 'past':
            endpoint = '/api/events/past';
            break;
          case 'upcoming':
          default:
            endpoint = '/api/events/upcoming';
            break;
        }

        console.log('Fetching events from:', endpoint);

        const response = await fetch(`http://localhost:3000${endpoint}`, { 
          headers,
          credentials: 'include'
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log('Received event data:', data);
        
        if (data.success) {
          const formattedEvents = data.events.map(event => ({
            ...event,
            StartDate: new Date(event.StartDate).toLocaleDateString(),
            StartTime: event.StartTime ? event.StartTime.slice(0, 5) : '',
            Image: `https://picsum.photos/seed/${event.EventID}/800/400`,
            MaxAttendees: parseInt(event.MaxAttendees) || 0,
            TicketsAvailable: parseInt(event.TicketsAvailable) || 0,
            CurrentAttendees: parseInt(event.CurrentAttendees) || 0
          }));
          
          setEvents(prev => ({
            ...prev,
            [activeTab]: formattedEvents
          }));
        } else {
          toast.error(data.message || 'Failed to fetch events');
        }
      } catch (error) {
        console.error('Error fetching events:', error);
        toast.error('Failed to fetch events');
      } finally {
        setLoading(false);
      }
    };

    // Only fetch if user is authenticated for protected tabs
    if (activeTab === 'upcoming' || 
        (isAuthenticated() && ['created', 'enrolled', 'past'].includes(activeTab))) {
      fetchEvents();
    }
}, [activeTab, isAuthenticated]);




  const getTabs = () => {
    if (!isAuthenticated()) {
      return [
        { value: 'upcoming', label: 'Upcoming Events' },
        { value: 'past', label: 'Past Events' }
      ];
    }
    
    if (canManageEvents) {
      return [
        { value: 'upcoming', label: 'Upcoming Events' },
        { value: 'enrolled', label: 'Enrolled Events' },
        { value: 'created', label: 'Created Events' }
      ];
    }
    
    return [
      { value: 'upcoming', label: 'Upcoming Events' },
      { value: 'enrolled', label: 'Enrolled Events' }
    ];
  };

    const handleNavigateToEvent = (event) => {
    if (isAuthenticated()) {
      navigate('/enrollment', { 
        state: { 
          eventDetails: {
            id: event.EventID,
            title: event.Title,
            description: event.Description,
            date: event.StartDate,
            time: event.StartTime,
            location: event.Location,
            attendees: event.MaxAttendees - event.TicketsAvailable,
            maxAttendees: event.MaxAttendees,
            image: getValidImageUrl(event.Image, event.EventID),
            price: event.Price || 0
          }
        }
      });
    } else {
      navigate('/login', { 
        state: { redirectUrl: '/enrollment' }
      });
    }
  };

  const handleEditEvent = (event, e) => {
    e.preventDefault();
    e.stopPropagation();
    
    console.log('Editing event:', event);
    console.log('Event ID:', event.EventID);
  
    navigate('/edit-event', {
      state: {
        eventId: event.EventID
      }
    });
  };

  const handleRemoveEnrollment = async (enrollmentId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:3000/api/enroll/${enrollmentId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });

      const data = await response.json();
      
      if (data.success) {
        setEvents(prev => ({
          ...prev,
          enrolled: prev.enrolled.filter(event => event.EnrollmentID !== enrollmentId)
        }));

        const upcomingResponse = await fetch(`http://localhost:3000/api/events/upcoming`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          credentials: 'include'
        });

        const upcomingData = await upcomingResponse.json();
        if (upcomingData.success) {
          const formattedEvents = upcomingData.events.map(event => ({
            ...event,
            StartDate: new Date(event.StartDate).toLocaleDateString(),
            StartTime: event.StartTime ? event.StartTime.slice(0, 5) : '',
            AttendeeCount: event.MaxAttendees - event.TicketsAvailable || 0,
            MaxAttendees: parseInt(event.MaxAttendees) || 0,
            Image: getValidImageUrl(event.Image, event.EventID)
          }));

          setEvents(prev => ({
            ...prev,
            upcoming: formattedEvents
          }));
        }

        toast.success('Enrollment removed successfully');
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      console.error('Error removing enrollment:', error);
      toast.error('Failed to remove enrollment');
    }
  };

  const renderEventButton = (event) => {
    if (!isAuthenticated()) {
      return (
        <button 
          className="enroll-button"
          onClick={() => handleNavigateToEvent(event)}
        >
          Register Now
        </button>
      );
    }

    if (activeTab === 'created' && canManageEvents) {
      return (
        <button 
          className="edit-button"
          onClick={(e) => handleEditEvent(event, e)}
        >
          Edit Event
        </button>
      );
    }

    if (activeTab === 'enrolled') {
      return (
        <button 
          className="enroll-button"
          onClick={() => handleRemoveEnrollment(event.EnrollmentID)}
        >
          Remove Enrollment
        </button>
      );
    }

    if (activeTab === 'past') {
      return null;
    }

    return (
      <button 
        className="enroll-button"
        onClick={() => handleNavigateToEvent(event)}
      >
        Enroll Now
      </button>
    );
  };

  const getNoEventsMessage = () => {
    switch(activeTab) {
      case 'created':
        return "You haven't created any events yet.";
      case 'enrolled':
        return "You haven't enrolled in any events yet.";
      case 'past':
        return "No past events available.";
      default:
        return "No upcoming events available.";
    }
  };

  if (authLoading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="admin-container">
      <Navbar />
      <h1 className="page-heading">
        {isAuthenticated() ? `Welcome, ${user.name}!` : 'Welcome!'}
      </h1>
      <main className="main-content">
        <div className="events-container">
          <div className="events-header">
            <TabButtons 
              activeTab={activeTab}
              onTabChange={setActiveTab}
              tabs={getTabs()}
            />
            {canManageEvents && isAuthenticated() && (
              <button 
                className="create-event-button"
                onClick={() => navigate('/create-event')}
              >
                Create Event
              </button>
            )}
          </div>

          <div className="events-list">
            {loading ? (
              <div className="loading">Loading events...</div>
            ) : events[activeTab]?.length === 0 ? (
              <div className="no-events-message">
                {getNoEventsMessage()}
              </div>
            ) : (
              events[activeTab]?.map((event) => (
                <div key={event.EventID} className="event-card">
                  <img 
                    src={getValidImageUrl(event.Image, event.EventID)}
                    alt={event.Title} 
                    className="event-image"
                    onError={(e) => {
                      e.target.src = `https://picsum.photos/seed/${event.EventID}/800/400`;
                    }}
                  />
                  <div className="event-content">
                    <h2 className="event-title">{event.Title}</h2>
                    <p className="event-description">{event.Description}</p>
                    <div className="event-footer">
                      <div className="event-timing">
                        <div className="event-details">
                          <span>📍 {event.Location}</span>
                          <div>
                            <span>📅 {event.StartDate}</span>
                            <span style={{marginLeft: '15px'}}>⏰ {event.StartTime}</span>
                          </div>
                          <div className="enrollment-count">
                            <span>👥 {event.MaxAttendees - event.TicketsAvailable}/{event.MaxAttendees} enrolled</span>
                          </div>
                        </div>
                      </div>
                      {renderEventButton(event)}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default HomePage;
