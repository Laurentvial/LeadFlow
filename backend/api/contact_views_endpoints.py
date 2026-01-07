from django.shortcuts import get_object_or_404
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from .models import ContactView
from .serializer import ContactViewSerializer
import logging

logger = logging.getLogger(__name__)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_contact_views(request):
    """Get all contact views for the current user"""
    try:
        is_fosse = request.GET.get('isFosse', 'false').lower() == 'true'
        views = ContactView.objects.filter(user=request.user, is_fosse=is_fosse).order_by('-created_at')
        serializer = ContactViewSerializer(views, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)
    except Exception as e:
        logger.error(f"Error getting contact views: {str(e)}")
        return Response({
            'error': 'Failed to get contact views',
            'detail': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_contact_view(request):
    """Create a new contact view"""
    try:
        data = request.data.copy()
        data['user'] = request.user.id
        
        # Serializer handles field name mapping automatically via source='is_fosse' etc.
        # No need to manually map here - serializer accepts frontend field names
        
        serializer = ContactViewSerializer(data=data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        logger.error(f"Error creating contact view: {str(e)}")
        return Response({
            'error': 'Failed to create contact view',
            'detail': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['PUT', 'PATCH'])
@permission_classes([IsAuthenticated])
def update_contact_view(request, view_id):
    """Update an existing contact view"""
    try:
        view = get_object_or_404(ContactView, id=view_id, user=request.user)
        data = request.data.copy()
        
        # Serializer handles field name mapping automatically via source='is_fosse' etc.
        # No need to manually map here - serializer accepts frontend field names
        
        serializer = ContactViewSerializer(view, data=data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        logger.error(f"Error updating contact view: {str(e)}")
        return Response({
            'error': 'Failed to update contact view',
            'detail': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_contact_view(request, view_id):
    """Delete a contact view"""
    try:
        view = get_object_or_404(ContactView, id=view_id, user=request.user)
        view.delete()
        return Response({'message': 'View deleted successfully'}, status=status.HTTP_200_OK)
    except Exception as e:
        logger.error(f"Error deleting contact view: {str(e)}")
        return Response({
            'error': 'Failed to delete contact view',
            'detail': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

